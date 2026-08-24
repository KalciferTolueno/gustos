import { and, asc, desc, eq, gt, gte, lte, ne, notInArray, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import { agentRuns, discoveryQueries, discoveryQueryEvents, events } from "../db/schema";
import type { CategorySlug } from "./taxonomy";

const regions = [
  "Arica y Parinacota", "Tarapacá", "Antofagasta", "Atacama", "Coquimbo", "Valparaíso", "Metropolitana",
  "O'Higgins", "Maule", "Ñuble", "Biobío", "La Araucanía", "Los Ríos", "Los Lagos", "Aysén", "Magallanes",
];
const coverageFamilies: Array<{ categorySlug: CategorySlug; terms: string }> = [
  { categorySlug: "gaming", terms: "esports, videojuegos, TCG y juegos de mesa" },
  { categorySlug: "anime", terms: "anime, manga y cosplay" },
  { categorySlug: "cine", terms: "cine independiente, festivales y funciones especiales" },
  { categorySlug: "musica", terms: "música urbana, reggaetón, trap, hip hop y K-pop" },
  { categorySlug: "musica", terms: "cumbia, tropical, salsa, bachata y folclore" },
  { categorySlug: "musica", terms: "electrónica, techno, house, trance y drum and bass" },
  { categorySlug: "musica", terms: "rock, indie, alternativa, metal, punk y hardcore" },
  { categorySlug: "musica", terms: "pop, jazz, blues, clásica, ópera y experimental" },
  { categorySlug: "fotografia", terms: "fotografía, exposiciones, talleres, concursos y photo walks" },
  { categorySlug: "astrofotografia", terms: "astrofotografía, observación astronómica y telescopios" },
  { categorySlug: "viajes", terms: "tours, viajes, naturaleza, aventura, patrimonio y rutas gastronómicas" },
  { categorySlug: "arte-cultura", terms: "arte, exposiciones, museos, galerías, artesanía y patrimonio" },
  { categorySlug: "teatro-danza", terms: "teatro, musicales, danza, ballet y performance" },
  { categorySlug: "comedia", terms: "stand-up comedy, humor e improvisación" },
  { categorySlug: "literatura", terms: "ferias del libro, lanzamientos, firmas, poesía y clubes de lectura" },
  { categorySlug: "gastronomia-ferias", terms: "ferias gastronómicas, mercados, diseño y emprendimiento" },
  { categorySlug: "deportes-bienestar", terms: "deportes, carreras, trekking, ciclismo, yoga y bienestar" },
  { categorySlug: "tecnologia-ciencia", terms: "tecnología, ciencia, innovación, programación y startups" },
  { categorySlug: "familia", terms: "actividades infantiles y panoramas familiares" },
  { categorySlug: "comunidad", terms: "encuentros sociales, fandoms, comunidades temáticas y culturas urbanas" },
];

export function normalizeDiscoveryQuery(value: string) {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CL").replace(/\s+/g, " ");
}

type CoverageQuery = {
  normalizedQuery: string;
  displayQuery: string;
  kind: "coverage";
  categorySlug: CategorySlug;
  region: string;
};

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

/** The current calendar quarter plus four following ones always covers the next 12 months. */
export function coverageQueryDefinitions(now = new Date()): CoverageQuery[] {
  const quarterStartMonth = Math.floor(now.getUTCMonth() / 3) * 3;
  const windows = Array.from({ length: 5 }, (_, index) => {
    const start = new Date(Date.UTC(now.getUTCFullYear(), quarterStartMonth + index * 3, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), quarterStartMonth + (index + 1) * 3, 0));
    return { start: isoDate(start), end: isoDate(end) };
  });
  return regions.flatMap((region) => coverageFamilies.flatMap(({ categorySlug, terms }) => windows.map(({ start, end }) => {
    const displayQuery = `${terms} en la región de ${region}, Chile, entre ${start} y ${end}`;
    return { normalizedQuery: normalizeDiscoveryQuery(displayQuery), displayQuery, kind: "coverage", categorySlug, region };
  })));
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
  const refreshDays = kind === "coverage" ? uniqueEventIds.length >= 15 ? 7 : uniqueEventIds.length ? 21 : 45 : 1;
  const nextRefreshAt = new Date(now.getTime() + refreshDays * 24 * 60 * 60_000);
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

export async function ensureScheduledCoverage() {
  const values = coverageQueryDefinitions();
  await getDb().insert(discoveryQueries).values(values).onConflictDoUpdate({
    target: discoveryQueries.normalizedQuery,
    set: { kind: "coverage", categorySlug: sql`excluded.category_slug`, region: sql`excluded.region` },
  });
  await getDb().update(discoveryQueries).set({ status: "archived", nextRefreshAt: new Date("2100-01-01") }).where(and(
    eq(discoveryQueries.kind, "coverage"),
    notInArray(discoveryQueries.normalizedQuery, values.map(({ normalizedQuery }) => normalizedQuery)),
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
      eq(discoveryQueries.kind, "coverage"),
      and(eq(discoveryQueries.kind, "user"), gte(discoveryQueries.requestCount, 3), gte(discoveryQueries.lastRequestedAt, activeSince)),
    ),
  )).orderBy(sql`case when ${discoveryQueries.kind} = 'user' then 0 else 1 end`, asc(discoveryQueries.nextRefreshAt)).limit(1);
  return query;
}

export async function coverageBootstrapPending() {
  const [{ count }] = await getDb().select({ count: sql<number>`count(*)` }).from(discoveryQueries).where(and(eq(discoveryQueries.kind, "coverage"), ne(discoveryQueries.status, "archived"), sql`${discoveryQueries.lastRefreshedAt} is null`));
  return Number(count) > 0;
}
