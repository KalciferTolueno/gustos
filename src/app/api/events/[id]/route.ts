import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { eventSourceObservations, eventSources, eventTopics, events, topics } from "@/db/schema";
import { currentUser } from "@/lib/current-user";
import { ensureEventImage } from "@/lib/event-images";
import { currentOrFutureEventCondition, isSpecificEventSourceUrl } from "@/lib/events";

const actionSchema = z.object({ action: z.enum(["approve", "reject"]) });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id } = await params;
  const db = getDb();
  const [event] = await db.select().from(events).where(and(eq(events.id, id), eq(events.status, "published"), currentOrFutureEventCondition())).limit(1);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [topicRows, sourceRows] = await Promise.all([
    db.select({ name: topics.name }).from(eventTopics).innerJoin(topics, eq(topics.id, eventTopics.topicId)).where(eq(eventTopics.eventId, id)),
    db.select().from(eventSources).where(and(eq(eventSources.eventId, id), eq(eventSources.status, "active"))).orderBy(desc(eventSources.isPrimary), eventSources.firstSeenAt).limit(4),
  ]);
  const publicSourceRows = sourceRows.filter((source) => isSpecificEventSourceUrl(source.url, event.title));
  const observations = publicSourceRows.length
    ? await db.select().from(eventSourceObservations).where(inArray(eventSourceObservations.eventSourceId, publicSourceRows.map((source) => source.id))).orderBy(desc(eventSourceObservations.checkedAt))
    : [];
  const publicEvent = { ...event, sourceUrl: isSpecificEventSourceUrl(event.sourceUrl, event.title) ? event.sourceUrl : "", submittedBy: undefined };
  return NextResponse.json({
    event: publicEvent,
    topicNames: topicRows.map((topic) => topic.name),
    sources: publicSourceRows.map((source) => ({ ...source, observations: observations.filter((observation) => observation.eventSourceId === source.id) })),
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  const { id } = await params;
  const [updated] = await getDb().update(events).set({
    status: parsed.data.action === "approve" ? "published" : "rejected",
    confidence: parsed.data.action === "approve" ? 100 : 0,
    verifiedAt: new Date(),
    catalogAuditVersion: 0,
    catalogAuditedAt: null,
    updatedAt: new Date(),
  }).where(eq(events.id, id)).returning({ id: events.id });
  if (updated && parsed.data.action === "approve") {
    try { await ensureEventImage(id); } catch (error) { console.error("Approved event image backfill failed", error); }
  }
  return updated ? NextResponse.json(updated) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
