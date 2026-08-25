import OpenAI from "openai";
import { and, asc, eq, gt, gte, or } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { eventSources, events } from "../db/schema";
import { agentUsage, beginAgentRun, finishAgentRun } from "./agent";
import { isSpecificEventSourceUrl, normalizedSourceUrl } from "./events";
import { consultedWebUrls } from "./web-evidence";
import { eventSourceContainsEvent } from "./event-source-validation";

const invalidSourceReason = "Fuente retirada: la página no contiene el evento anunciado.";

const resultSchema = z.object({ sourceName: z.string().min(2), sourceUrl: z.url() });
const jsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: { sourceName: { type: "string" }, sourceUrl: { type: "string" } },
  required: ["sourceName", "sourceUrl"],
} as const;

type SourceAuditEvent = {
  id: string;
  title: string;
  startsAt: Date;
  city: string | null;
  sourceUrl: string;
  status: string;
  statusReason: string | null;
};

async function auditSource(event: SourceAuditEvent) {
  const db = getDb();
  let sourceMatches = false;
  if (isSpecificEventSourceUrl(event.sourceUrl, event.title)) {
    try { sourceMatches = await eventSourceContainsEvent(event.sourceUrl, event.title); } catch { /* Repair unreachable and unsafe pages. */ }
  }
  const storedSources = await db.select({ id: eventSources.id, name: eventSources.name, url: eventSources.url, normalizedUrl: eventSources.normalizedUrl }).from(eventSources).where(and(eq(eventSources.eventId, event.id), eq(eventSources.status, "active"))).orderBy(asc(eventSources.firstSeenAt));
  const validStoredSources: typeof storedSources = [];
  for (const source of storedSources) {
    const isCurrent = normalizedSourceUrl(source.url, true) === normalizedSourceUrl(event.sourceUrl, true);
    let valid = isCurrent && sourceMatches;
    if (!valid && !isCurrent && isSpecificEventSourceUrl(source.url, event.title)) {
      try { valid = await eventSourceContainsEvent(source.url, event.title); } catch { /* Hide unreachable and unsafe secondary pages. */ }
    }
    if (valid) validStoredSources.push(source);
    else await db.update(eventSources).set({ status: "invalid", isPrimary: false, lastCheckedAt: new Date() }).where(eq(eventSources.id, source.id));
  }
  if (sourceMatches) {
    await db.update(events).set({ status: "published", statusReason: event.status === "expired" || event.statusReason === invalidSourceReason ? null : event.statusReason, updatedAt: new Date() }).where(eq(events.id, event.id));
    return { checked: true as const, valid: true as const, repaired: false, quarantined: false };
  }
  const replacement = validStoredSources[0];
  if (replacement) {
    await db.transaction(async (tx) => {
      await tx.update(events).set({ sourceName: replacement.name, sourceUrl: replacement.url, status: "published", statusReason: null, imageUrl: null, catalogAuditVersion: 0, catalogAuditedAt: null, updatedAt: new Date() }).where(eq(events.id, event.id));
      await tx.update(eventSources).set({ isPrimary: false }).where(eq(eventSources.eventId, event.id));
      await tx.update(eventSources).set({ isPrimary: true, status: "active", lastCheckedAt: new Date() }).where(eq(eventSources.id, replacement.id));
    });
    return { checked: true as const, valid: true as const, repaired: true, quarantined: false };
  }
  await db.transaction(async (tx) => {
    await tx.update(events).set({ status: "pending", statusReason: invalidSourceReason, imageUrl: null, updatedAt: new Date() }).where(eq(events.id, event.id));
    await tx.update(eventSources).set({ status: "invalid", isPrimary: false }).where(and(eq(eventSources.eventId, event.id), eq(eventSources.normalizedUrl, normalizedSourceUrl(event.sourceUrl))));
  });
  const reservation = await beginAgentRun("source-repair", event.title);
  if (reservation.skipped) return { checked: true as const, valid: false as const, repaired: false, quarantined: true };
  let searches = 0;
  let usage = agentUsage(undefined, 0);
  try {
    const response = await new OpenAI({ apiKey: process.env.OPENAI_API_KEY }).responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5.6-luna",
      reasoning: { effort: "low" },
      tools: [{ type: "web_search", search_context_size: "medium", user_location: { type: "approximate", country: "CL", timezone: "America/Santiago" } }],
      tool_choice: "required",
      // @ts-expect-error OpenAI accepts this field, but this SDK release omits it from request types.
      max_tool_calls: 2,
      include: ["web_search_call.action.sources"],
      text: { format: { type: "json_schema", name: "event_source", strict: true, schema: jsonSchema } },
      input: `Encuentra la ficha, venta, inscripción o publicación directa del evento ${JSON.stringify(event.title)} anunciado para ${event.startsAt.toISOString().slice(0, 10)}${event.city ? ` en ${event.city}` : ""}, Chile. La URL actual ${event.sourceUrl} no contiene el evento en su página viva. Devuelve únicamente otra URL específica del evento que hayas consultado mediante búsqueda web; no devuelvas la URL actual, páginas de inicio, listados ni agendas generales.`,
    });
    searches = response.output.filter((item) => item.type === "web_search_call").length;
    usage = agentUsage(response.usage, searches);
    const result = resultSchema.parse(JSON.parse(response.output_text));
    const consulted = new Set([...consultedWebUrls(response.output)].map((url) => normalizedSourceUrl(url, true)));
    const sourceUrl = normalizedSourceUrl(result.sourceUrl);
    if (normalizedSourceUrl(result.sourceUrl, true) === normalizedSourceUrl(event.sourceUrl, true)
      || !isSpecificEventSourceUrl(result.sourceUrl, event.title)
      || !consulted.has(normalizedSourceUrl(result.sourceUrl, true))
      || !(await eventSourceContainsEvent(result.sourceUrl, event.title))) throw new Error("Repair source was not consulted, is generic, or does not contain the event");
    await db.transaction(async (tx) => {
      await tx.update(events).set({ sourceName: result.sourceName, sourceUrl: result.sourceUrl, status: "published", statusReason: null, imageUrl: null, verifiedAt: new Date(), catalogAuditVersion: 0, catalogAuditedAt: null, updatedAt: new Date() }).where(eq(events.id, event.id));
      await tx.update(eventSources).set({ isPrimary: false }).where(eq(eventSources.eventId, event.id));
      await tx.insert(eventSources).values({ eventId: event.id, name: result.sourceName, url: result.sourceUrl, normalizedUrl: sourceUrl, isPrimary: true, lastCheckedAt: new Date(), nextCheckAt: new Date(Date.now() + 24 * 60 * 60_000) }).onConflictDoUpdate({
        target: [eventSources.eventId, eventSources.normalizedUrl],
        set: { name: result.sourceName, url: result.sourceUrl, isPrimary: true, status: "active", lastCheckedAt: new Date() },
      });
    });
    await finishAgentRun(reservation.runId, { status: "succeeded", searches, candidates: 1, published: 0, ...usage });
    return { checked: true as const, valid: true as const, repaired: true, quarantined: false };
  } catch (error) {
    await finishAgentRun(reservation.runId, { status: "failed", searches, error: error instanceof Error ? error.message.slice(0, 2000) : "Source repair failed", ...usage });
    return { checked: true as const, valid: false as const, repaired: false, quarantined: true };
  }
}

export async function auditEventSource(id: string) {
  const [event] = await getDb().select({ id: events.id, title: events.title, startsAt: events.startsAt, city: events.city, sourceUrl: events.sourceUrl, status: events.status, statusReason: events.statusReason }).from(events).where(eq(events.id, id)).limit(1);
  return event ? auditSource(event) : { checked: false as const, valid: false as const, repaired: false, quarantined: false };
}

export async function repairGenericEventSources(limit = 4) {
  const db = getDb();
  const rows = await db.select({ id: events.id, title: events.title, startsAt: events.startsAt, city: events.city, sourceUrl: events.sourceUrl, status: events.status, statusReason: events.statusReason }).from(events).where(and(
    or(eq(events.status, "published"), and(eq(events.status, "pending"), eq(events.statusReason, invalidSourceReason))),
    or(gt(events.startsAt, new Date()), gte(events.endsAt, new Date()), eq(events.eventState, "postponed")),
  )).orderBy(asc(events.updatedAt)).limit(limit);
  let checked = 0;
  let repaired = 0;
  for (const event of rows) {
    const result = await auditSource(event);
    checked += 1;
    if (result.repaired) repaired += 1;
  }
  return { checked, repaired };
}
