import OpenAI from "openai";
import { and, asc, eq, gt, or } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { eventSources, events } from "../db/schema";
import { agentUsage, beginAgentRun, finishAgentRun } from "./agent";
import { isSpecificEventSourceUrl, normalizedSourceUrl } from "./events";

const resultSchema = z.object({ sourceName: z.string().min(2), sourceUrl: z.url() });
const jsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: { sourceName: { type: "string" }, sourceUrl: { type: "string" } },
  required: ["sourceName", "sourceUrl"],
} as const;

export async function repairGenericEventSources(limit = 4) {
  const db = getDb();
  const rows = await db.select({ id: events.id, title: events.title, startsAt: events.startsAt, city: events.city, sourceUrl: events.sourceUrl }).from(events).where(and(
    eq(events.status, "published"),
    or(gt(events.startsAt, new Date()), eq(events.eventState, "postponed")),
  )).orderBy(asc(events.updatedAt)).limit(limit * 4);
  let checked = 0;
  let repaired = 0;
  for (const event of rows) {
    if (isSpecificEventSourceUrl(event.sourceUrl)) continue;
    const reservation = await beginAgentRun("source-repair", event.title);
    if (reservation.skipped) break;
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
        input: `Encuentra la ficha, venta, inscripción o publicación directa del evento ${JSON.stringify(event.title)} anunciado para ${event.startsAt.toISOString().slice(0, 10)}${event.city ? ` en ${event.city}` : ""}, Chile. La URL actual ${event.sourceUrl} es una portada inválida. Devuelve únicamente una URL específica del evento que hayas consultado mediante búsqueda web; no devuelvas páginas de inicio, listados o agendas generales.`,
      });
      searches = response.output.filter((item) => item.type === "web_search_call").length;
      usage = agentUsage(response.usage, searches);
      const result = resultSchema.parse(JSON.parse(response.output_text));
      const consulted = new Set(response.output.flatMap((item) => item.type === "web_search_call" && item.action.type === "search" ? (item.action.sources ?? []).map((source) => normalizedSourceUrl(source.url, true)) : []));
      const sourceUrl = normalizedSourceUrl(result.sourceUrl);
      if (!isSpecificEventSourceUrl(result.sourceUrl) || !consulted.has(normalizedSourceUrl(result.sourceUrl, true))) throw new Error("Repair source was not consulted or is generic");
      await db.transaction(async (tx) => {
        await tx.update(events).set({ sourceName: result.sourceName, sourceUrl: result.sourceUrl, updatedAt: new Date() }).where(eq(events.id, event.id));
        await tx.update(eventSources).set({ isPrimary: false }).where(eq(eventSources.eventId, event.id));
        await tx.insert(eventSources).values({ eventId: event.id, name: result.sourceName, url: result.sourceUrl, normalizedUrl: sourceUrl, isPrimary: true, lastCheckedAt: new Date(), nextCheckAt: new Date(Date.now() + 24 * 60 * 60_000) }).onConflictDoUpdate({
          target: [eventSources.eventId, eventSources.normalizedUrl],
          set: { name: result.sourceName, url: result.sourceUrl, isPrimary: true, status: "active", lastCheckedAt: new Date() },
        });
      });
      repaired += 1;
      await finishAgentRun(reservation.runId, { status: "succeeded", searches, candidates: 1, published: 0, ...usage });
    } catch (error) {
      await finishAgentRun(reservation.runId, { status: "failed", searches, error: error instanceof Error ? error.message.slice(0, 2000) : "Source repair failed", ...usage });
    }
    checked += 1;
    if (checked >= limit) break;
  }
  return { checked, repaired };
}
