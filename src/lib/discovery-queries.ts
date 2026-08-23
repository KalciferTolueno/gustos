import { and, asc, desc, eq, gt, gte, like, lte, ne, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import { agentRuns, discoveryQueries, discoveryQueryEvents, events } from "../db/schema";

const regions = [
  "Arica y Parinacota", "Tarapacá", "Antofagasta", "Atacama", "Coquimbo", "Valparaíso", "Metropolitana",
  "O'Higgins", "Maule", "Ñuble", "Biobío", "La Araucanía", "Los Ríos", "Los Lagos", "Aysén", "Magallanes",
];
const musicFamilies = [
  "pop, rock e indie", "urbana, hip hop y reggaetón", "electrónica, techno y house",
  "metal, punk y hardcore", "jazz, blues, clásica y experimental", "folclore, tropical, cumbia y latina",
];
const musicPeriods = [
  { label: "desde hoy hasta el 30 de septiembre de 2026", until: "2026-10-01T03:00:00Z" },
  { label: "del 1 de octubre al 31 de diciembre de 2026", until: "2027-01-01T03:00:00Z" },
  { label: "del 1 de enero al 31 de marzo de 2027", until: "2027-04-01T03:00:00Z" },
  { label: "del 1 de abril al 30 de junio de 2027", until: "2027-07-01T04:00:00Z" },
  { label: "del 1 de julio al 30 de septiembre de 2027", until: "2027-10-01T03:00:00Z" },
  { label: "del 1 de octubre al 31 de diciembre de 2027", until: "2028-01-01T03:00:00Z" },
];

export function normalizeDiscoveryQuery(value: string) {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CL").replace(/\s+/g, " ");
}

export async function recordDiscoveryQuery(displayQuery: string) {
  const normalizedQuery = normalizeDiscoveryQuery(displayQuery);
  const now = new Date();
  const [query] = await getDb().insert(discoveryQueries).values({
    normalizedQuery,
    displayQuery: displayQuery.trim(),
    requestCount: 1,
    lastRequestedAt: now,
  }).onConflictDoUpdate({
    target: discoveryQueries.normalizedQuery,
    set: {
      displayQuery: displayQuery.trim(),
      requestCount: sql`${discoveryQueries.requestCount} + 1`,
      lastRequestedAt: now,
    },
  }).returning();
  return query;
}

export function queryIsFresh(query: { lastRefreshedAt: Date | null; lastResultCount?: number }) {
  const maxAge = query.lastResultCount === 0 ? 2 * 60_000 : 24 * 60 * 60_000;
  return Boolean(query.lastRefreshedAt && Date.now() - query.lastRefreshedAt.getTime() < maxAge);
}

export async function markQueryRunning(id: number) {
  await getDb().update(discoveryQueries).set({ status: "running", lastError: null }).where(eq(discoveryQueries.id, id));
}

export async function completeQuery(id: number, eventIds: string[], kind: string) {
  const now = new Date();
  const uniqueEventIds = [...new Set(eventIds)];
  const nextRefreshAt = new Date(now.getTime() + (kind === "music" ? 30 : 1) * 24 * 60 * 60_000);
  await getDb().transaction(async (tx) => {
    await tx.delete(discoveryQueryEvents).where(eq(discoveryQueryEvents.queryId, id));
    if (uniqueEventIds.length) await tx.insert(discoveryQueryEvents).values(uniqueEventIds.map((eventId) => ({ queryId: id, eventId }))).onConflictDoNothing();
    await tx.update(discoveryQueries).set({
      status: "ready",
      lastRefreshedAt: now,
      nextRefreshAt,
      lastResultCount: uniqueEventIds.length,
      lastError: null,
    }).where(eq(discoveryQueries.id, id));
  });
}

export async function queryEventIds(queryId: number) {
  const now = new Date();
  const rows = await getDb().select({ eventId: discoveryQueryEvents.eventId }).from(discoveryQueryEvents).innerJoin(events, eq(events.id, discoveryQueryEvents.eventId)).where(and(
    eq(discoveryQueryEvents.queryId, queryId),
    eq(events.status, "published"),
    or(gt(events.startsAt, now), gte(events.endsAt, now), eq(events.eventState, "postponed")),
  ));
  return rows.map((row) => row.eventId);
}

export async function failQuery(id: number, error: unknown) {
  const message = error instanceof Error ? error.message.slice(0, 1000) : "Unknown discovery error";
  await getDb().update(discoveryQueries).set({
    status: "failed",
    lastError: message,
    nextRefreshAt: new Date(Date.now() + 60 * 60_000),
  }).where(eq(discoveryQueries.id, id));
}

export async function ensureMusicCoverage() {
  const [{ count }] = await getDb().select({ count: sql<number>`count(*)` }).from(discoveryQueries).where(eq(discoveryQueries.kind, "music"));
  if (Number(count) === 0) {
    const values = regions.flatMap((region) => musicFamilies.flatMap((family) => musicPeriods.map((period) => {
      const displayQuery = `eventos de música ${family} en la región de ${region}, Chile, ${period.label}`;
      return { normalizedQuery: normalizeDiscoveryQuery(displayQuery), displayQuery, kind: "music" };
    })));
    await getDb().insert(discoveryQueries).values(values).onConflictDoNothing();
  }
  const expired = musicPeriods.filter((period) => new Date(period.until) <= new Date());
  if (expired.length) await getDb().update(discoveryQueries).set({ status: "archived", nextRefreshAt: new Date("2100-01-01") }).where(and(
    eq(discoveryQueries.kind, "music"),
    or(...expired.map((period) => like(discoveryQueries.displayQuery, `%, ${period.label}`))),
  ));
}

export async function recoverStaleQueries() {
  const [active] = await getDb().select({ target: agentRuns.target }).from(agentRuns).where(eq(agentRuns.status, "running")).orderBy(desc(agentRuns.startedAt)).limit(1);
  await getDb().update(discoveryQueries).set({ status: "queued" }).where(active?.target
    ? and(eq(discoveryQueries.status, "running"), ne(discoveryQueries.displayQuery, active.target))
    : eq(discoveryQueries.status, "running"));
}

export async function nextDueQuery() {
  const now = new Date();
  const activeSince = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const [query] = await getDb().select().from(discoveryQueries).where(and(
    lte(discoveryQueries.nextRefreshAt, now),
    ne(discoveryQueries.status, "running"),
    or(
      eq(discoveryQueries.kind, "music"),
      and(eq(discoveryQueries.kind, "user"), gte(discoveryQueries.requestCount, 3), gte(discoveryQueries.lastRequestedAt, activeSince)),
    ),
  )).orderBy(sql`case when ${discoveryQueries.kind} = 'user' then 0 else 1 end`, asc(discoveryQueries.nextRefreshAt)).limit(1);
  return query;
}

export async function musicBootstrapPending() {
  const [{ count }] = await getDb().select({ count: sql<number>`count(*)` }).from(discoveryQueries).where(and(eq(discoveryQueries.kind, "music"), ne(discoveryQueries.status, "archived"), sql`${discoveryQueries.lastRefreshedAt} is null`));
  return Number(count) > 0;
}
