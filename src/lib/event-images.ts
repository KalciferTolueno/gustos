import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import OpenAI from "openai";
import { and, asc, desc, eq, gt, isNotNull, isNull, or } from "drizzle-orm";
import { getDb } from "../db";
import { eventSources, events } from "../db/schema";
import { agentUsage, beginAgentRun, finishAgentRun } from "./agent";

function publicAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return a !== 0 && a !== 10 && a !== 127 && !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && b === 168);
  }
  const value = address.toLowerCase();
  if (value.startsWith("::ffff:")) return publicAddress(value.slice(7));
  return value !== "::1" && !value.startsWith("fc") && !value.startsWith("fd") && !value.startsWith("fe8") && !value.startsWith("fe9") && !value.startsWith("fea") && !value.startsWith("feb");
}

async function publicUrl(value: string) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hostname === "localhost" || url.hostname.endsWith(".local")) throw new Error("Unsafe event URL");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => !publicAddress(address))) throw new Error("Private event URL");
  return { url, address: addresses[0].address };
}

function decodeHtml(value: string) {
  return value.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

export function extractEventImages(html: string, pageUrl: string) {
  const images: string[] = [];
  const add = (value?: string) => {
    if (!value) return;
    try {
      const url = new URL(decodeHtml(value.trim()), pageUrl).toString();
      if (!images.includes(url) && !/\.(svg|gif|woff2?|ttf|css|js|mp4)(\?|$)/i.test(url)) images.push(url);
    } catch { /* Ignore malformed markup. */ }
  };
  const collectJsonImages = (value: unknown) => {
    if (typeof value === "string") return add(value);
    if (Array.isArray(value)) return value.forEach(collectJsonImages);
    if (!value || typeof value !== "object") return;
    const object = value as Record<string, unknown>;
    if (object.image) collectJsonImages(object.image);
    if (typeof object.url === "string" && (object.width || object.height)) add(object.url);
    for (const child of Object.values(object)) if (child && typeof child === "object") collectJsonImages(child);
  };
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*(["'])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { collectJsonImages(JSON.parse(decodeHtml(match[2]))); } catch { /* Invalid JSON-LD is common. */ }
  }
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = Object.fromEntries([...match[0].matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gis)].map((item) => [item[1].toLowerCase(), decodeHtml(item[3].trim())]));
    const key = (attributes.property ?? attributes.name ?? "").toLowerCase();
    if (["og:image", "og:image:url", "twitter:image", "twitter:image:src"].includes(key)) add(attributes.content);
  }
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const attributes = Object.fromEntries([...match[0].matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gis)].map((item) => [item[1].toLowerCase(), item[3].trim()]));
    add(attributes["data-src"]);
    add(attributes["data-lazy-src"]);
    add(attributes.srcset?.split(",")[0]?.trim().split(/\s+/)[0]);
    add(attributes.src);
  }
  for (const match of html.matchAll(/background(?:-image)?\s*:[^;}]*?url\(\s*(["']?)(.*?)\1\s*\)/gi)) add(match[2]);
  return images.slice(0, 8);
}

export function extractEventImage(html: string, pageUrl: string) {
  return extractEventImages(html, pageUrl)[0] ?? null;
}

async function requestPage(value: string) {
  const { url, address } = await publicUrl(value);
  return new Promise<{ url: URL; status: number; location?: string; contentType?: string; html: string }>((resolve, reject) => {
    const options = { hostname: address, port: url.port || undefined, path: `${url.pathname}${url.search}`, method: "GET", headers: { host: url.host, "user-agent": "Mozilla/5.0 (compatible; DatitoEventBot/1.0)" }, signal: AbortSignal.timeout(8_000) };
    const request = url.protocol === "https:" ? httpsRequest({ ...options, servername: url.hostname }) : httpRequest(options);
    request.on("response", (response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 1_000_000) request.destroy(new Error("Event page is too large"));
        else chunks.push(chunk);
      });
      response.on("end", () => resolve({ url, status: response.statusCode ?? 0, location: response.headers.location, contentType: response.headers["content-type"], html: Buffer.concat(chunks).toString("utf8") }));
    });
    request.on("error", reject);
    request.end();
  });
}

export async function findEventPageImages(sourceUrl: string) {
  let url = sourceUrl;
  for (let redirects = 0; redirects < 4; redirects += 1) {
    const response = await requestPage(url);
    if (response.status >= 300 && response.status < 400 && response.location) {
      url = new URL(response.location, response.url).toString();
      continue;
    }
    if (response.status < 200 || response.status >= 300 || !response.contentType?.includes("text/html")) return [];
    const images = extractEventImages(response.html, response.url.toString());
    const safeImages = await Promise.all(images.map(async (image) => {
      try { await publicUrl(image); return image; } catch { return null; }
    }));
    return safeImages.filter((image): image is string => Boolean(image));
  }
  return [];
}

export async function findEventPageImage(sourceUrl: string) {
  return (await findEventPageImages(sourceUrl))[0] ?? null;
}

export async function selectMatchingEventImage(title: string, sourceUrls: string[], existingImage?: string | null) {
  const pages = await Promise.allSettled(sourceUrls.slice(0, 4).map(findEventPageImages));
  const pageImages = pages.map((page) => page.status === "fulfilled" ? page.value : []);
  const candidates: string[] = [];
  if (existingImage) {
    try { await publicUrl(existingImage); candidates.push(existingImage); } catch { /* Ignore an unsafe stored URL. */ }
  }
  for (let index = 0; candidates.length < 12 && pageImages.some((images) => index < images.length); index += 1) {
    for (const images of pageImages) if (candidates.length < 12 && images[index] && !candidates.includes(images[index])) candidates.push(images[index]);
  }
  if (!process.env.OPENAI_API_KEY) return candidates[0] ?? null;
  const reservation = await beginAgentRun("image-selection", title);
  if (reservation.skipped) return candidates[0];
  let usage = agentUsage(undefined, 0);
  let searches = 0;
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = candidates.length ? await openai.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5.6-luna", reasoning: { effort: "low" },
      input: [{ role: "user", content: [
        { type: "input_text", text: `Selecciona la imagen que corresponda específicamente al evento ${JSON.stringify(title)}. Las imágenes siguientes corresponden, en el mismo orden, a estas URLs:\n${candidates.map((url, index) => `${index + 1}. ${url}`).join("\n")}\nPrioriza afiches, banners o fotografías del evento; evita logos genéricos, iconos y publicidad no relacionada. Si ninguna coincide inequívocamente, devuelve imageUrl=null.` },
        ...candidates.map((image_url) => ({ type: "input_image" as const, image_url, detail: "low" as const })),
      ] }],
      text: { format: { type: "json_schema", name: "event_image", strict: true, schema: { type: "object", additionalProperties: false, properties: { imageUrl: { type: ["string", "null"], enum: [null, ...candidates] } }, required: ["imageUrl"] } } },
    }) : await openai.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5.6-luna", reasoning: { effort: "low" },
      tools: [{ type: "web_search", search_context_size: "medium", user_location: { type: "approximate", country: "CL", timezone: "America/Santiago" } }],
      tool_choice: "required",
      // @ts-expect-error OpenAI accepts this field, but this SDK release omits it from request types.
      max_tool_calls: Math.max(1, Number(process.env.AGENT_IMAGE_SEARCHES_PER_EVENT ?? 4)),
      input: `Busca un afiche, banner o fotografía real y específica del evento ${JSON.stringify(title)}. Revisa primero estas páginas: ${sourceUrls.join(", ")}. Devuelve la URL pública directa de una imagen que haga match inequívoco con el nombre del evento; nunca uses stock, logos genéricos ni imágenes de otro evento.`,
      text: { format: { type: "json_schema", name: "event_image_search", strict: true, schema: { type: "object", additionalProperties: false, properties: { imageUrl: { type: ["string", "null"] } }, required: ["imageUrl"] } } },
    });
    searches = response.output.filter((item) => item.type === "web_search_call").length;
    usage = agentUsage(response.usage, searches);
    const selected = JSON.parse(response.output_text).imageUrl as string | null;
    if (selected) await publicUrl(selected);
    await finishAgentRun(reservation.runId, { status: "succeeded", searches, candidates: candidates.length, published: 0, ...usage });
    return candidates.length ? selected && candidates.includes(selected) ? selected : null : selected;
  } catch (error) {
    await finishAgentRun(reservation.runId, { status: "failed", searches, ...usage, error: error instanceof Error ? error.message.slice(0, 2000) : "Image selection failed" });
    return null;
  }
}

export async function ensureEventImage(id: string) {
  const db = getDb();
  const [event] = await db.select({ title: events.title, imageUrl: events.imageUrl }).from(events).where(eq(events.id, id)).limit(1);
  if (!event || event.imageUrl) return event?.imageUrl ?? null;
  const sources = await db.select({ url: eventSources.url }).from(eventSources).where(eq(eventSources.eventId, id)).orderBy(desc(eventSources.isPrimary), asc(eventSources.firstSeenAt)).limit(4);
  const imageUrl = await selectMatchingEventImage(event.title, sources.map((source) => source.url));
  await db.update(events).set({ imageUrl, updatedAt: new Date() }).where(eq(events.id, id));
  return imageUrl;
}

export async function backfillMissingEventImages(limit = 12) {
  const db = getDb();
  const now = new Date();
  const rows = await db.select({ id: events.id }).from(events).where(and(
    eq(events.status, "published"),
    isNull(events.imageUrl),
    or(gt(events.startsAt, now), eq(events.eventState, "postponed")),
  )).orderBy(asc(events.updatedAt)).limit(limit);
  let updated = 0;
  for (const event of rows) {
    try {
      const imageUrl = await ensureEventImage(event.id);
      if (imageUrl) updated += 1;
    } catch {
      await db.update(events).set({ updatedAt: new Date() }).where(eq(events.id, event.id));
    }
  }
  return { checked: rows.length, updated };
}

export async function auditEventImages(limit = 6) {
  const db = getDb();
  const now = new Date();
  const rows = await db.select({ id: events.id, title: events.title, imageUrl: events.imageUrl }).from(events).where(and(
    eq(events.status, "published"),
    isNotNull(events.imageUrl),
    or(gt(events.startsAt, now), eq(events.eventState, "postponed")),
  )).orderBy(asc(events.updatedAt)).limit(limit);
  let checked = 0;
  let corrected = 0;
  for (const event of rows) {
    const sourcesForEvent = await db.select({ url: eventSources.url }).from(eventSources).where(eq(eventSources.eventId, event.id)).orderBy(desc(eventSources.isPrimary), asc(eventSources.firstSeenAt)).limit(4);
    try {
      const imageUrl = await selectMatchingEventImage(event.title, sourcesForEvent.map((source) => source.url), event.imageUrl);
      await db.update(events).set({ imageUrl, updatedAt: new Date() }).where(eq(events.id, event.id));
      checked += 1;
      if (imageUrl !== event.imageUrl) corrected += 1;
    } catch {
      await db.update(events).set({ updatedAt: new Date() }).where(eq(events.id, event.id));
    }
    if (checked >= limit) break;
  }
  return { checked, corrected };
}
