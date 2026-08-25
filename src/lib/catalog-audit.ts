import { and, asc, eq, gt, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import { events } from "../db/schema";
import { auditEventImage } from "./event-images";
import { auditEventLocation } from "./event-locations";
import { auditEventSource } from "./source-repair";
import { verifyEvent } from "./verification";

// Increment this whenever a new catalog-wide invariant must be applied to all
// existing events. Rows keep their completed version in PostgreSQL, so a worker
// restart or deployment resumes instead of beginning again.
export const CATALOG_AUDIT_VERSION = 2;

export function catalogAuditIsCurrent(version: number) {
  return version >= CATALOG_AUDIT_VERSION;
}

export function catalogAuditCandidateCondition(now = new Date()) {
  const possibleOngoingLookback = new Date(now);
  possibleOngoingLookback.setUTCFullYear(possibleOngoingLookback.getUTCFullYear() - 3);
  return and(
    inArray(events.status, ["published", "expired"]),
    lt(events.catalogAuditVersion, CATALOG_AUDIT_VERSION),
    or(
      gt(events.startsAt, now),
      gte(events.endsAt, now),
      eq(events.eventState, "postponed"),
      and(isNull(events.endsAt), gte(events.startsAt, possibleOngoingLookback)),
    ),
  );
}

export async function auditExistingEvents(limit = 1) {
  const db = getDb();
  const now = new Date();
  await db.update(events).set({ catalogAuditVersion: 0 }).where(and(
    eq(events.catalogAuditVersion, -1),
    lte(events.catalogAuditedAt, new Date(now.getTime() - 60 * 60_000)),
  ));
  const rows = await db.select({ id: events.id }).from(events).where(and(
    catalogAuditCandidateCondition(now),
    gte(events.catalogAuditVersion, 0),
  )).orderBy(sql`${events.catalogAuditedAt} asc nulls first`, asc(events.startsAt)).limit(Math.max(1, limit));

  let checked = 0;
  let completed = 0;
  let quarantined = 0;
  for (const event of rows) {
    const [claimed] = await db.update(events).set({ catalogAuditVersion: -1, catalogAuditedAt: new Date() }).where(and(
      eq(events.id, event.id),
      gte(events.catalogAuditVersion, 0),
      lt(events.catalogAuditVersion, CATALOG_AUDIT_VERSION),
    )).returning({ id: events.id });
    if (!claimed) continue;
    checked += 1;
    let complete = false;
    try {
      const source = await auditEventSource(event.id);
      if (source.quarantined) {
        quarantined += 1;
        complete = true;
      } else if (source.valid) {
        const verification = await verifyEvent(event.id);
        const image = await auditEventImage(event.id);
        const location = await auditEventLocation(event.id);
        complete = !verification.skipped && image.checked && location.checked;
      }
    } catch (error) {
      console.error(new Date().toISOString(), `catalog audit failed for event ${event.id}`, error);
    }
    await db.update(events).set({
      catalogAuditVersion: complete ? CATALOG_AUDIT_VERSION : 0,
      catalogAuditedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(events.id, event.id));
    if (complete) completed += 1;
  }

  const [{ remaining }] = await db.select({ remaining: sql<number>`count(*)` }).from(events).where(catalogAuditCandidateCondition(now));
  return { version: CATALOG_AUDIT_VERSION, checked, completed, quarantined, remaining: Number(remaining) };
}
