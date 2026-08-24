import { createHash } from "node:crypto";
import { and, asc, eq, gt, gte, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import { eventSourceObservations, eventSources, eventTopics, events, topics, type EventRow } from "../db/schema";
import { categoryNames, topicSlug, type CategorySlug } from "./taxonomy";

export type EventCard = Pick<
  EventRow,
  | "id"
  | "categoryId"
  | "title"
  | "description"
  | "startsAt"
  | "endsAt"
  | "city"
  | "region"
  | "venue"
  | "address"
  | "latitude"
  | "longitude"
  | "locationPrecision"
  | "status"
  | "eventState"
  | "statusReason"
  | "confidence"
  | "sourceName"
  | "sourceUrl"
  | "imageUrl"
  | "priceLabel"
  | "discoveredByAi"
  | "verifiedAt"
  | "updatedAt"
  | "modality"
> & { categoryName: string; topicNames: string[] };

const demoEvents: EventCard[] = [
  {
    id: "demo-techno",
    categoryId: null,
    categoryName: "Música",
    title: "Noche techno independiente",
    description: "Evento ficticio para demostrar recomendaciones por genero y ciudad.",
    startsAt: new Date("2026-08-29T23:00:00-04:00"),
    endsAt: null,
    city: "Santiago",
    region: "Metropolitana",
    venue: "Club de demostracion",
    address: "Bellavista, Santiago",
    latitude: -33.4327,
    longitude: -70.6357,
    locationPrecision: "approximate",
    status: "published",
    eventState: "scheduled",
    statusReason: null,
    confidence: 100,
    sourceName: "Datos de demostracion",
    sourceUrl: "",
    imageUrl: "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=900&q=80",
    priceLabel: "$12.000",
    discoveredByAi: false,
    verifiedAt: new Date("2026-08-23T12:00:00-04:00"),
    updatedAt: new Date("2026-08-23T12:00:00-04:00"),
    modality: "in_person",
    topicNames: ["Techno", "Musica electronica"],
  },
  {
    id: "demo-eva",
    categoryId: null,
    categoryName: "Anime",
    title: "Encuentro de fans de Evangelion",
    description: "Actividad ficticia de comunidad con conversatorio e intercambio.",
    startsAt: new Date("2026-09-05T16:00:00-04:00"),
    endsAt: null,
    city: "Santiago",
    region: "Metropolitana",
    venue: "Centro cultural de demostracion",
    address: "Providencia, Santiago",
    latitude: -33.4255,
    longitude: -70.6158,
    locationPrecision: "approximate",
    status: "published",
    eventState: "scheduled",
    statusReason: null,
    confidence: 100,
    sourceName: "Datos de demostracion",
    sourceUrl: "",
    imageUrl: "https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&w=900&q=80",
    priceLabel: "Gratis",
    discoveredByAi: false,
    verifiedAt: new Date("2026-08-23T12:00:00-04:00"),
    updatedAt: new Date("2026-08-23T12:00:00-04:00"),
    modality: "in_person",
    topicNames: ["Evangelion", "Anime"],
  },
  {
    id: "demo-valorant",
    categoryId: null,
    categoryName: "Gaming",
    title: "Copa comunitaria de Valorant",
    description: "Torneo ficticio abierto a equipos amateur de todo Chile.",
    startsAt: new Date("2026-09-12T14:00:00-04:00"),
    endsAt: null,
    city: "Online",
    region: "Todo Chile",
    venue: "Discord",
    address: null,
    latitude: null,
    longitude: null,
    locationPrecision: "online",
    status: "published",
    eventState: "scheduled",
    statusReason: null,
    confidence: 100,
    sourceName: "Datos de demostracion",
    sourceUrl: "",
    imageUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=900&q=80",
    priceLabel: "Gratis",
    discoveredByAi: false,
    verifiedAt: new Date("2026-08-23T12:00:00-04:00"),
    updatedAt: new Date("2026-08-23T12:00:00-04:00"),
    modality: "online",
    topicNames: ["Valorant", "Gaming"],
  },
  {
    id: "demo-miku",
    categoryId: null,
    categoryName: "Comunidad",
    title: "Hatsune Miku fan meetup",
    description: "Evento ficticio con cosplay, musica y arte de la comunidad.",
    startsAt: new Date("2026-10-03T15:30:00-03:00"),
    endsAt: null,
    city: "Valparaiso",
    region: "Valparaiso",
    venue: "Paseo de demostracion",
    address: "Valparaiso",
    latitude: -33.0472,
    longitude: -71.6127,
    locationPrecision: "city",
    status: "published",
    eventState: "scheduled",
    statusReason: null,
    confidence: 100,
    sourceName: "Datos de demostracion",
    sourceUrl: "",
    imageUrl: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80",
    priceLabel: "Gratis",
    discoveredByAi: false,
    verifiedAt: new Date("2026-08-23T12:00:00-04:00"),
    updatedAt: new Date("2026-08-23T12:00:00-04:00"),
    modality: "in_person",
    topicNames: ["Hatsune Miku", "Anime"],
  },
];

export function eventKey(title: string, startsAt: Date, sourceUrl: string, venue?: string | null, city?: string | null) {
  return createHash("sha256")
    .update(`${title.trim().toLocaleLowerCase("es-CL")}|${startsAt.toISOString()}|${sourceUrl.trim()}|${normalizedText(venue)}|${normalizedText(city)}`)
    .digest("hex");
}

function normalizedText(value?: string | null) {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CL").replace(/[^a-z0-9]+/g, " ").trim();
}

export function normalizedSourceUrl(value: string, stripTracking = false) {
  try {
    const url = new URL(value);
    url.hash = "";
    if (stripTracking) for (const key of [...url.searchParams.keys()]) if (key.startsWith("utm_") || key === "fbclid" || key === "gclid") url.searchParams.delete(key);
    url.hostname = url.hostname.replace(/^www\./, "").toLocaleLowerCase("en-US");
    url.pathname = url.pathname.replace(/\/$/, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim();
  }
}

export function eventHasNotEnded(startsAt: Date, endsAt: Date | null, now = new Date()) {
  return (endsAt ?? startsAt) >= now;
}

export function acceptedEventState(state: "scheduled" | "postponed" | "cancelled" | "unknown", official: boolean, independentlyCancelled: boolean) {
  if (state === "cancelled") return official || independentlyCancelled ? state : null;
  return official && state !== "unknown" ? state : null;
}

export function eventIdentityKey(title: string, startsAt: Date, venue?: string | null, city?: string | null) {
  return createHash("md5").update(`${normalizedText(title)}|${normalizedText(venue)}|${normalizedText(city)}|${startsAt.toISOString().slice(0, 16)}`).digest("hex");
}

export async function listEvents(): Promise<{ events: EventCard[]; demo: boolean }> {
  if (!process.env.DATABASE_URL) return { events: demoEvents, demo: true };

  const db = getDb();
  const now = new Date();
  const categoryRows = await db.select({ id: topics.id, name: topics.name }).from(topics).where(eq(topics.type, "category"));
  const categories = new Map(categoryRows.map((category) => [category.id, category.name]));
  const rows = await db
    .select({ event: events, topicName: topics.name })
    .from(events)
    .leftJoin(eventTopics, eq(eventTopics.eventId, events.id))
    .leftJoin(topics, eq(topics.id, eventTopics.topicId))
    .where(and(eq(events.status, "published"), or(gt(events.startsAt, now), gte(events.endsAt, now), eq(events.eventState, "postponed"))))
    .orderBy(asc(events.startsAt));

  const grouped = new Map<string, EventCard>();
  for (const row of rows) {
    const current = grouped.get(row.event.id) ?? { ...row.event, categoryName: categories.get(row.event.categoryId ?? 0) ?? "Panorama", topicNames: [] };
    if (row.topicName) current.topicNames.push(row.topicName);
    grouped.set(row.event.id, current);
  }
  return { events: [...grouped.values()], demo: false };
}

export async function saveCandidate(candidate: {
  title: string;
  description: string;
  startsAt: Date;
  endsAt?: Date | null;
  city?: string | null;
  region?: string | null;
  venue?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  categorySlug: CategorySlug;
  topicNames: string[];
  artistNames?: string[];
  destinationNames?: string[];
  sourceName: string;
  sourceUrl: string;
  imageUrl?: string | null;
  confidence: number;
  references?: Array<{ name: string; url: string }>;
}) {
  const db = getDb();
  const externalKey = eventKey(candidate.title, candidate.startsAt, candidate.sourceUrl, candidate.venue, candidate.city);
  const identityKey = eventIdentityKey(candidate.title, candidate.startsAt, candidate.venue, candidate.city);
  const status = candidate.confidence >= 85 ? "published" : "pending";
  const { topicNames, artistNames = [], destinationNames = [], references = [], categorySlug, ...event } = candidate;
  const now = new Date();
  const nextCheckAt = new Date(now.getTime() + (candidate.startsAt.getTime() - now.getTime() <= 30 * 24 * 60 * 60_000 ? 1 : candidate.startsAt.getTime() - now.getTime() <= 90 * 24 * 60 * 60_000 ? 3 : 7) * 24 * 60 * 60_000);

  return db.transaction(async (tx) => {
    const [category] = await tx.insert(topics).values({ name: categoryNames[categorySlug], slug: categorySlug, type: "category", searchEnabled: true }).onConflictDoUpdate({ target: topics.slug, set: { name: categoryNames[categorySlug], type: "category", searchEnabled: true } }).returning({ id: topics.id });
    const primaryUrl = normalizedSourceUrl(candidate.sourceUrl);
    const [sourceMatch] = await tx.select({
      eventId: eventSources.eventId,
      identityKey: events.identityKey,
      title: events.title,
      startsAt: events.startsAt,
      venue: events.venue,
      city: events.city,
    }).from(eventSources).innerJoin(events, eq(events.id, eventSources.eventId)).where(and(eq(eventSources.normalizedUrl, primaryUrl), eq(eventSources.isPrimary, true))).limit(1);
    const [identityMatch] = await tx.select({ id: events.id }).from(events).where(eq(events.identityKey, identityKey)).limit(1);
    const [externalMatch] = await tx.select({ id: events.id }).from(events).where(and(eq(events.externalKey, externalKey), eq(events.identityKey, identityKey))).limit(1);
    const sourceIdentity = sourceMatch && eventIdentityKey(sourceMatch.title, sourceMatch.startsAt, sourceMatch.venue, sourceMatch.city);
    const existingId = identityMatch?.id ?? externalMatch?.id ?? (sourceMatch && sourceIdentity === identityKey ? sourceMatch.eventId : undefined);
    const [existing] = existingId ? await tx.select({ status: events.status, identityKey: events.identityKey, imageUrl: events.imageUrl, categoryId: events.categoryId }).from(events).where(eq(events.id, existingId)).limit(1) : [];
    const existingIdentity = !identityMatch || identityMatch.id === existingId ? identityKey : null;
    const [saved] = existing
      ? await tx.update(events).set(existing.status === "pending"
        ? { ...event, externalKey, identityKey: existingIdentity, categoryId: category.id, status, verifiedAt: now, updatedAt: now }
        : { identityKey: existingIdentity, categoryId: existing.categoryId ?? category.id, imageUrl: existing.imageUrl ?? candidate.imageUrl, updatedAt: now }).where(eq(events.id, existingId)).returning({ id: events.id, status: events.status })
      : await tx.insert(events).values({ ...event, externalKey, identityKey, categoryId: category.id, status, eventState: "scheduled", discoveredByAi: true, verifiedAt: now }).returning({ id: events.id, status: events.status });

    const labels: Array<[string, string, number]> = [
      ...topicNames.map((name): [string, string, number] => [name, "topic", category.id]),
      ...artistNames.map((name): [string, string, number] => [name, "artist", category.id]),
      ...destinationNames.map((name): [string, string, number] => [name, "destination", category.id]),
    ];
    for (const [name, type, parentId] of labels) {
      const slug = topicSlug(name);
      if (!slug) continue;
      const [topic] = await tx.insert(topics).values({ name, slug, type, parentId, searchEnabled: false }).onConflictDoUpdate({ target: topics.slug, set: { name } }).returning({ id: topics.id });
      await tx.insert(eventTopics).values({ eventId: saved.id, topicId: topic.id }).onConflictDoNothing();
    }

    await tx.update(eventSources).set({ isPrimary: false }).where(eq(eventSources.eventId, saved.id));
    const allReferences = [{ name: candidate.sourceName, url: candidate.sourceUrl }, ...references];
    const seen = new Set<string>();
    for (const reference of allReferences) {
      const normalizedUrl = normalizedSourceUrl(reference.url);
      if (!normalizedUrl || seen.has(normalizedUrl)) continue;
      seen.add(normalizedUrl);
      const [source] = await tx.insert(eventSources).values({
        eventId: saved.id,
        name: reference.name,
        url: reference.url,
        normalizedUrl,
        isPrimary: normalizedUrl === primaryUrl,
        lastCheckedAt: now,
        nextCheckAt,
      }).onConflictDoUpdate({
        target: [eventSources.eventId, eventSources.normalizedUrl],
        set: { name: reference.name, url: reference.url, isPrimary: normalizedUrl === primaryUrl, status: "active", lastCheckedAt: now, nextCheckAt },
      }).returning({ id: eventSources.id });
      await tx.insert(eventSourceObservations).values({
        eventSourceId: source.id,
        observedTitle: candidate.title,
        observedStartsAt: candidate.startsAt,
        observedEndsAt: candidate.endsAt,
        observedVenue: candidate.venue,
        observedState: "scheduled",
        confidence: candidate.confidence,
        evidence: "Discovered and verified through web search",
      });
    }
    return { status: saved.status, eventId: saved.id };
  });
}

export async function popularTopics(limit = 8) {
  if (!process.env.DATABASE_URL) return ["techno", "anime", "Evangelion", "Hatsune Miku", "Valorant", "League of Legends"];
  const db = getDb();
  const rows = await db
    .select({ name: topics.name })
    .from(topics)
    .where(eq(topics.searchEnabled, true))
    .orderBy(sql`${topics.id} asc`)
    .limit(limit);
  return rows.map((row) => row.name);
}
