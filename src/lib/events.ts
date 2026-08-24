import { createHash } from "node:crypto";
import { and, asc, desc, eq, gt, gte, inArray, lt, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import { discoveryQueryEvents, eventSourceObservations, eventSources, eventTopics, events, topics, type EventRow } from "../db/schema";
import { categoryNames, topicSlug, type CategorySlug } from "./taxonomy";

export type EventCard = Pick<
  EventRow,
  | "id"
  | "categoryId"
  | "title"
  | "description"
  | "startsAt"
  | "endsAt"
  | "timePrecision"
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
    timePrecision: "exact",
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
    timePrecision: "exact",
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
    timePrecision: "exact",
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
    timePrecision: "exact",
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

export function isSpecificEventSourceUrl(value: string) {
  try {
    const url = new URL(value);
    const path = url.pathname.replace(/\/$/, "").toLocaleLowerCase("en-US");
    return Boolean(url.search || (path && !["/", "/inicio", "/home", "/index"].includes(path)));
  } catch {
    return false;
  }
}

export function eventHasNotEnded(startsAt: Date, endsAt: Date | null, now = new Date()) {
  return (endsAt ?? startsAt) >= now;
}

export function acceptedEventState(state: "scheduled" | "postponed" | "cancelled" | "unknown", official: boolean, independentlyCancelled: boolean) {
  if (state === "cancelled") return official || independentlyCancelled ? state : null;
  return official && state !== "unknown" ? state : null;
}

export function eventOccurrenceKey(title: string, startsAt: Date) {
  return `${normalizedText(title)}|${startsAt.toISOString().slice(0, 16)}`;
}

export function sameEventTitle(first: string, second: string) {
  const firstTitle = normalizedText(first);
  const secondTitle = normalizedText(second);
  if (firstTitle === secondTitle) return { matches: true, exact: true };
  const base = (title: string) => normalizedText(title.split(/\s+(?:—|–|-)\s+|[:|]/, 1)[0]);
  const firstBase = base(first);
  const secondBase = base(second);
  return { matches: firstBase.length >= 5 && firstBase === secondBase, exact: false };
}

function eventSeriesTitle(title: string) {
  return title.split(/\s+(?:—|–|-)\s+|[:|]/, 1)[0].trim();
}

function compatibleLocation(first?: string | null, second?: string | null) {
  const firstValue = normalizedText(first);
  const secondValue = normalizedText(second);
  return !firstValue || !secondValue || firstValue === secondValue || firstValue.includes(secondValue) || secondValue.includes(firstValue);
}

export function sameEventOccurrence(first: { title: string; startsAt: Date; timePrecision?: string; city?: string | null; venue?: string | null }, second: { title: string; startsAt: Date; timePrecision?: string; city?: string | null; venue?: string | null }) {
  const firstCity = normalizedText(first.city);
  const secondCity = normalizedText(second.city);
  const title = sameEventTitle(first.title, second.title);
  const sameTime = first.startsAt.toISOString().slice(0, 16) === second.startsAt.toISOString().slice(0, 16);
  const sameDay = first.startsAt.toISOString().slice(0, 10) === second.startsAt.toISOString().slice(0, 10);
  const dateOnly = first.timePrecision === "date" || second.timePrecision === "date";
  const compatibleCities = !firstCity || !secondCity || firstCity === secondCity || (isSantiagoMetroCity(firstCity) && isSantiagoMetroCity(secondCity));
  return title.matches && (sameTime || (sameDay && (!title.exact || dateOnly))) && compatibleCities && compatibleLocation(first.venue, second.venue);
}

function sameFestivalSeries(first: { title: string; startsAt: Date; city?: string | null; sourceName?: string; sourceUrl?: string }, second: { title: string; startsAt: Date; city?: string | null; sourceName?: string; sourceUrl?: string }) {
  const firstSeries = normalizedText(eventSeriesTitle(first.title));
  const secondSeries = normalizedText(eventSeriesTitle(second.title));
  const sameDay = first.startsAt.toISOString().slice(0, 10) === second.startsAt.toISOString().slice(0, 10);
  const firstCity = normalizedText(first.city);
  const secondCity = normalizedText(second.city);
  const compatibleCities = !firstCity || !secondCity || firstCity === secondCity || (isSantiagoMetroCity(firstCity) && isSantiagoMetroCity(secondCity));
  const firstPublisher = normalizedText(first.sourceName);
  const secondPublisher = normalizedText(second.sourceName);
  const firstDomain = sourceDomain(first.sourceUrl);
  const secondDomain = sourceDomain(second.sourceUrl);
  const samePublisher = Boolean(firstPublisher && firstPublisher === secondPublisher)
    || Boolean(firstDomain && firstDomain === secondDomain);
  return firstSeries.length >= 12 && firstSeries === secondSeries && sameDay && compatibleCities && samePublisher;
}

function sourceDomain(value?: string) {
  try { return new URL(value ?? "").hostname.replace(/^www\./, "").toLocaleLowerCase("en-US"); } catch { return ""; }
}

function isSantiagoMetroCity(city: string) {
  return new Set([
    "santiago", "cerrillos", "cerro navia", "conchali", "el bosque", "estacion central", "huechuraba", "independencia", "la cisterna", "la florida", "la granja", "la pintana", "la reina", "las condes", "lo barnechea", "lo espejo", "lo prado", "macul", "maipu", "nunoa", "pedro aguirre cerda", "penalolen", "providencia", "pudahuel", "quinta normal", "recoleta", "renca", "san joaquin", "san miguel", "san ramon", "vitacura",
  ]).has(city);
}

export function eventIdentityKey(title: string, startsAt: Date, city?: string | null, venue?: string | null) {
  return createHash("md5").update(`${eventOccurrenceKey(title, startsAt)}|${normalizedText(city)}|${normalizedText(venue)}`).digest("hex");
}

export async function consolidateDuplicateEvents(limit = 20) {
  const db = getDb();
  const rows = await db.select().from(events).orderBy(asc(events.createdAt));
  const occurrenceGroups = new Map<string, typeof rows>();
  for (const event of rows) {
    const key = event.startsAt.toISOString().slice(0, 10);
    occurrenceGroups.set(key, [...(occurrenceGroups.get(key) ?? []), event]);
  }
  const groups = [...occurrenceGroups.values()].flatMap((eventsOnSameDay) => {
    const clusters: Array<typeof rows> = [];
    const specificFirst = eventsOnSameDay.sort((a, b) => Number(Boolean(b.city)) + Number(Boolean(b.venue)) - Number(Boolean(a.city)) - Number(Boolean(a.venue)));
    for (const event of specificFirst) {
      const matches = clusters.filter((cluster) => sameEventOccurrence(cluster[0], event) || sameFestivalSeries(cluster[0], event));
      if (matches.length === 1) matches[0].push(event);
      else clusters.push([event]);
    }
    return clusters;
  });
  let merged = 0;
  for (const group of groups.filter((items) => items.length > 1).slice(0, limit)) {
    group.sort((a, b) => (Number(b.status === "published") * 2 + Number(b.status === "pending")) - (Number(a.status === "published") * 2 + Number(a.status === "pending")) || b.confidence - a.confidence || Number(Boolean(b.imageUrl)) - Number(Boolean(a.imageUrl)) || a.createdAt.getTime() - b.createdAt.getTime());
    const [keeper, ...duplicates] = group;
    const canonicalCity = keeper.city ?? group.find((event) => event.city)?.city;
    const seriesTitles = group.map((event) => normalizedText(eventSeriesTitle(event.title)));
    const sharedSeries = Boolean(seriesTitles[0]) && seriesTitles.every((title) => title === seriesTitles[0]);
    const canonicalTitle = sharedSeries ? eventSeriesTitle(keeper.title) : keeper.title;
    const venueNames = [...new Set(group.map((event) => event.venue).filter((venue): venue is string => Boolean(venue)))];
    const canonicalVenue = sharedSeries && venueNames.length > 1 ? "Múltiples recintos" : keeper.venue ?? venueNames[0];
    const identityKey = eventIdentityKey(canonicalTitle, keeper.startsAt, canonicalCity, canonicalVenue);
    const duplicateIds = duplicates.map((event) => event.id);
    await db.transaction(async (tx) => {
      const topicRows = await tx.select({ topicId: eventTopics.topicId }).from(eventTopics).where(inArray(eventTopics.eventId, duplicateIds));
      for (const topic of topicRows) await tx.insert(eventTopics).values({ eventId: keeper.id, topicId: topic.topicId }).onConflictDoNothing();
      const queryRows = await tx.select({ queryId: discoveryQueryEvents.queryId }).from(discoveryQueryEvents).where(inArray(discoveryQueryEvents.eventId, duplicateIds));
      for (const query of queryRows) await tx.insert(discoveryQueryEvents).values({ eventId: keeper.id, queryId: query.queryId }).onConflictDoNothing();

      const sourceRows = await tx.select().from(eventSources).where(inArray(eventSources.eventId, [keeper.id, ...duplicateIds])).orderBy(desc(eventSources.isPrimary), asc(eventSources.firstSeenAt));
      const keptSources = new Map(sourceRows.filter((source) => source.eventId === keeper.id).map((source) => [source.normalizedUrl, source]));
      for (const source of sourceRows.filter((item) => item.eventId !== keeper.id)) {
        const existing = keptSources.get(source.normalizedUrl);
        if (existing) {
          await tx.update(eventSourceObservations).set({ eventSourceId: existing.id }).where(eq(eventSourceObservations.eventSourceId, source.id));
          await tx.delete(eventSources).where(eq(eventSources.id, source.id));
        } else {
          await tx.update(eventSources).set({ eventId: keeper.id, isPrimary: false }).where(eq(eventSources.id, source.id));
          keptSources.set(source.normalizedUrl, source);
        }
      }
      await tx.delete(events).where(inArray(events.id, duplicateIds));
      const best = group.find((event) => event.imageUrl);
      const longestDescription = group.map((event) => event.description).sort((a, b) => b.length - a.length)[0];
      const exactTiming = group.find((event) => event.timePrecision === "exact");
      await tx.update(events).set({
        title: canonicalTitle,
        identityKey,
        imageUrl: keeper.imageUrl ?? best?.imageUrl,
        description: longestDescription,
        startsAt: exactTiming?.startsAt ?? keeper.startsAt,
        endsAt: exactTiming?.endsAt ?? keeper.endsAt ?? group.find((event) => event.endsAt)?.endsAt,
        timePrecision: exactTiming ? "exact" : "date",
        categoryId: keeper.categoryId ?? group.find((event) => event.categoryId)?.categoryId,
        city: canonicalCity,
        region: keeper.region ?? group.find((event) => event.region)?.region,
        venue: canonicalVenue,
        address: keeper.address ?? group.find((event) => event.address)?.address,
        latitude: keeper.latitude ?? group.find((event) => event.latitude != null)?.latitude,
        longitude: keeper.longitude ?? group.find((event) => event.longitude != null)?.longitude,
        priceLabel: keeper.priceLabel ?? group.find((event) => event.priceLabel)?.priceLabel,
        submittedBy: keeper.submittedBy ?? group.find((event) => event.submittedBy)?.submittedBy,
        eventState: group.filter((event) => event.eventState !== "scheduled").sort((a, b) => b.confidence - a.confidence)[0]?.eventState ?? keeper.eventState,
        statusReason: group.filter((event) => event.eventState !== "scheduled").sort((a, b) => b.confidence - a.confidence)[0]?.statusReason ?? keeper.statusReason,
        status: group.some((event) => event.status === "published") ? "published" : group.some((event) => event.status === "pending") ? "pending" : keeper.status,
        confidence: Math.max(...group.map((event) => event.confidence)),
        updatedAt: new Date(),
      }).where(eq(events.id, keeper.id));
    });
    merged += duplicateIds.length;
  }
  return { duplicatesMerged: merged };
}

export async function promoteSpecificEventSources(limit = 24) {
  const db = getDb();
  const rows = await db.select({ id: events.id, sourceUrl: events.sourceUrl }).from(events).where(eq(events.status, "published")).orderBy(asc(events.updatedAt)).limit(limit * 4);
  let upgraded = 0;
  for (const event of rows) {
    if (isSpecificEventSourceUrl(event.sourceUrl)) continue;
    const sourcesForEvent = await db.select({ name: eventSources.name, url: eventSources.url }).from(eventSources).where(eq(eventSources.eventId, event.id)).orderBy(desc(eventSources.isPrimary), asc(eventSources.firstSeenAt)).limit(4);
    const directSource = sourcesForEvent.find((source) => isSpecificEventSourceUrl(source.url));
    if (!directSource) continue;
    await db.update(events).set({ sourceName: directSource.name, sourceUrl: directSource.url, updatedAt: new Date() }).where(eq(events.id, event.id));
    upgraded += 1;
    if (upgraded >= limit) break;
  }
  return { sourceUrlsUpgraded: upgraded };
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
  timePrecision: "exact" | "date";
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
  const identityKey = eventIdentityKey(candidate.title, candidate.startsAt, candidate.city, candidate.venue);
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
      city: events.city,
      venue: events.venue,
    }).from(eventSources).innerJoin(events, eq(events.id, eventSources.eventId)).where(eq(eventSources.normalizedUrl, primaryUrl)).limit(1);
    const [identityMatch] = await tx.select({ id: events.id }).from(events).where(eq(events.identityKey, identityKey)).limit(1);
    const [externalMatch] = await tx.select({ id: events.id }).from(events).where(and(eq(events.externalKey, externalKey), eq(events.identityKey, identityKey))).limit(1);
    const dayStart = new Date(candidate.startsAt); dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);
    const occurrenceRows = await tx.select({ id: events.id, title: events.title, startsAt: events.startsAt, timePrecision: events.timePrecision, city: events.city, venue: events.venue }).from(events).where(and(gte(events.startsAt, dayStart), lt(events.startsAt, dayEnd)));
    const compatibleOccurrences = occurrenceRows.filter((item) => sameEventOccurrence(item, candidate));
    const occurrenceCities = new Set(compatibleOccurrences.map((item) => normalizedText(item.city)).filter(Boolean));
    const occurrenceVenues = new Set(compatibleOccurrences.map((item) => normalizedText(item.venue)).filter(Boolean));
    const occurrenceMatch = (normalizedText(candidate.city) || occurrenceCities.size <= 1) && (normalizedText(candidate.venue) || occurrenceVenues.size <= 1) ? compatibleOccurrences[0] : undefined;
    const sourceMatches = sourceMatch && sameEventOccurrence(sourceMatch, candidate);
    const existingId = identityMatch?.id ?? externalMatch?.id ?? occurrenceMatch?.id ?? (sourceMatch && sourceMatches ? sourceMatch.eventId : undefined);
    const [existing] = existingId ? await tx.select({ status: events.status, identityKey: events.identityKey, imageUrl: events.imageUrl, categoryId: events.categoryId, timePrecision: events.timePrecision, city: events.city, region: events.region, venue: events.venue, address: events.address, sourceName: events.sourceName, sourceUrl: events.sourceUrl }).from(events).where(eq(events.id, existingId)).limit(1) : [];
    const existingIdentity = existing?.status !== "pending" && existing?.identityKey ? existing.identityKey : !identityMatch || identityMatch.id === existingId ? identityKey : null;
    const candidateHasExactTime = existing?.timePrecision === "date" && candidate.timePrecision === "exact";
    const shouldUpgradeSource = Boolean(existing && isSpecificEventSourceUrl(candidate.sourceUrl) && !isSpecificEventSourceUrl(existing.sourceUrl));
    const [saved] = existing
      ? await tx.update(events).set(existing.status === "pending"
        ? { ...event, externalKey, identityKey: existingIdentity, categoryId: category.id, status, verifiedAt: now, updatedAt: now }
        : { identityKey: existingIdentity, categoryId: existing.categoryId ?? category.id, imageUrl: existing.imageUrl ?? candidate.imageUrl, sourceName: shouldUpgradeSource ? candidate.sourceName : existing.sourceName, sourceUrl: shouldUpgradeSource ? candidate.sourceUrl : existing.sourceUrl, startsAt: candidateHasExactTime ? candidate.startsAt : undefined, endsAt: candidateHasExactTime ? candidate.endsAt : undefined, timePrecision: candidateHasExactTime ? "exact" : existing.timePrecision, city: existing.city ?? candidate.city, region: existing.region ?? candidate.region, venue: existing.venue ?? candidate.venue, address: existing.address ?? candidate.address, updatedAt: now }).where(eq(events.id, existingId)).returning({ id: events.id, status: events.status })
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

    const allReferences = [{ name: candidate.sourceName, url: candidate.sourceUrl }, ...references];
    const seen = new Set<string>();
    const existingSources = await tx.select({ id: eventSources.id, normalizedUrl: eventSources.normalizedUrl, isPrimary: eventSources.isPrimary }).from(eventSources).where(eq(eventSources.eventId, saved.id)).orderBy(desc(eventSources.isPrimary), asc(eventSources.firstSeenAt)).limit(4);
    let sourceCount = existingSources.length;
    let primarySourceId: number | undefined;
    for (const reference of allReferences) {
      const normalizedUrl = normalizedSourceUrl(reference.url);
      if (!normalizedUrl || seen.has(normalizedUrl)) continue;
      seen.add(normalizedUrl);
      const existingSource = existingSources.find((source) => source.normalizedUrl === normalizedUrl);
      if (!existingSource && sourceCount >= 4 && normalizedUrl !== primaryUrl) continue;
      const [source] = await tx.insert(eventSources).values({
        eventId: saved.id,
        name: reference.name,
        url: reference.url,
        normalizedUrl,
        isPrimary: false,
        lastCheckedAt: now,
        nextCheckAt,
      }).onConflictDoUpdate({
        target: [eventSources.eventId, eventSources.normalizedUrl],
        set: { name: reference.name, url: reference.url, status: "active", lastCheckedAt: now, nextCheckAt },
      }).returning({ id: eventSources.id });
      if (!existingSource) {
        sourceCount += 1;
        existingSources.push({ id: source.id, normalizedUrl, isPrimary: false });
      }
      if (normalizedUrl === primaryUrl) primarySourceId = source.id;
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
    if (primarySourceId) {
      await tx.update(eventSources).set({ isPrimary: false }).where(eq(eventSources.eventId, saved.id));
      await tx.update(eventSources).set({ isPrimary: true }).where(eq(eventSources.id, primarySourceId));
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
