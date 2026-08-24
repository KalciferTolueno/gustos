import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

const ignoredTitleWords = new Set([
  "a", "al", "con", "de", "del", "el", "en", "evento", "exhibicion", "exposicion", "festival", "fotografica",
  "la", "las", "los", "para", "por", "presentacion", "show", "the", "un", "una", "y",
]);

function normalizedText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CL").replace(/[^a-z0-9]+/g, " ").trim();
}

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
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hostname === "localhost" || url.hostname.endsWith(".local")) throw new Error("Unsafe event source URL");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => !publicAddress(address))) throw new Error("Private event source URL");
  return { url, address: addresses[0].address };
}

async function requestHtml(value: string) {
  const { url, address } = await publicUrl(value);
  return new Promise<{ url: URL; status: number; location?: string; contentType?: string; html: string }>((resolve, reject) => {
    const options = { hostname: address, port: url.port || undefined, path: `${url.pathname}${url.search}`, method: "GET", headers: { host: url.host, accept: "text/html,application/xhtml+xml", "user-agent": "Mozilla/5.0 (compatible; DatitoEventBot/1.0)" }, signal: AbortSignal.timeout(8_000) };
    const request = url.protocol === "https:" ? httpsRequest({ ...options, servername: url.hostname }) : httpRequest(options);
    request.on("response", (response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 1_000_000) request.destroy(new Error("Event source page is too large"));
        else chunks.push(chunk);
      });
      response.on("end", () => resolve({ url, status: response.statusCode ?? 0, location: response.headers.location, contentType: response.headers["content-type"], html: Buffer.concat(chunks).toString("utf8") }));
    });
    request.on("error", reject);
    request.end();
  });
}

function pageText(html: string) {
  const descriptiveAttributes = [...html.matchAll(/<(?:meta|img)\b[^>]*>/gi)].flatMap((element) =>
    [...element[0].matchAll(/(?:content|alt|title)\s*=\s*(["'])(.*?)\1/gis)].map((attribute) => attribute[2]));
  return normalizedText(`${descriptiveAttributes.join(" ")} ${html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|amp|quot|apos|#39);/gi, " ")}`);
}

export function sourceTextMatchesEventTitle(html: string, title: string) {
  const text = pageText(html);
  const baseTitle = title.split(/\s+(?:—|–|-)\s+|[:|]/, 1)[0];
  const allTerms = [...new Set(normalizedText(baseTitle).split(" ").filter(Boolean))];
  const specificTerms = allTerms.filter((term) => term.length >= 3 && !ignoredTitleWords.has(term));
  const terms = specificTerms.length ? specificTerms : allTerms.filter((term) => term.length >= 2);
  if (!terms.length) return false;
  const words = new Set(text.split(" "));
  const matches = terms.filter((term) => words.has(term)).length;
  return matches >= Math.min(2, terms.length) && matches / terms.length >= 0.6;
}

export async function eventSourceContainsEvent(value: string, title: string) {
  let url = value;
  for (let redirects = 0; redirects < 4; redirects += 1) {
    const response = await requestHtml(url);
    if (response.status >= 300 && response.status < 400 && response.location) {
      url = new URL(response.location, response.url).toString();
      continue;
    }
    if (response.status < 200 || response.status >= 300 || !/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(response.contentType ?? "")) return false;
    return sourceTextMatchesEventTitle(response.html, title);
  }
  return false;
}
