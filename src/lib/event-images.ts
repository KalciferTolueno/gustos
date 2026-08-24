import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { and, asc, eq, gt, isNull, or } from "drizzle-orm";
import { getDb } from "../db";
import { eventSources, events } from "../db/schema";

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

export function extractEventImage(html: string, pageUrl: string) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = Object.fromEntries([...match[0].matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gis)].map((item) => [item[1].toLowerCase(), decodeHtml(item[3].trim())]));
    const key = (attributes.property ?? attributes.name ?? "").toLowerCase();
    if (["og:image", "og:image:url", "twitter:image", "twitter:image:src"].includes(key) && attributes.content) return new URL(attributes.content, pageUrl).toString();
  }
  return null;
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

export async function findEventPageImage(sourceUrl: string) {
  let url = sourceUrl;
  for (let redirects = 0; redirects < 4; redirects += 1) {
    const response = await requestPage(url);
    if (response.status >= 300 && response.status < 400 && response.location) {
      url = new URL(response.location, response.url).toString();
      continue;
    }
    if (response.status < 200 || response.status >= 300 || !response.contentType?.includes("text/html")) return null;
    const image = extractEventImage(response.html, response.url.toString());
    if (!image) return null;
    await publicUrl(image);
    return image;
  }
  return null;
}

export async function backfillMissingEventImages(limit = 12) {
  const db = getDb();
  const now = new Date();
  const rows = await db.select({ id: events.id, sourceUrl: eventSources.url }).from(events).innerJoin(eventSources, and(eq(eventSources.eventId, events.id), eq(eventSources.isPrimary, true))).where(and(
    eq(events.status, "published"),
    isNull(events.imageUrl),
    or(gt(events.startsAt, now), eq(events.eventState, "postponed")),
  )).orderBy(asc(events.updatedAt)).limit(limit);
  let updated = 0;
  for (const event of rows) {
    try {
      const imageUrl = await findEventPageImage(event.sourceUrl);
      await db.update(events).set({ imageUrl, updatedAt: new Date() }).where(eq(events.id, event.id));
      if (imageUrl) updated += 1;
    } catch {
      await db.update(events).set({ updatedAt: new Date() }).where(eq(events.id, event.id));
    }
  }
  return { checked: rows.length, updated };
}
