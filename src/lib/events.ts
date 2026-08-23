import { createHash } from "node:crypto";
import { and, asc, eq, gt, gte, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import { eventTopics, events, topics, type EventRow } from "../db/schema";

export type EventCard = Pick<
  EventRow,
  | "id"
  | "title"
  | "description"
  | "startsAt"
  | "city"
  | "region"
  | "venue"
  | "address"
  | "latitude"
  | "longitude"
  | "locationPrecision"
  | "status"
  | "confidence"
  | "sourceName"
  | "sourceUrl"
  | "imageUrl"
  | "priceLabel"
  | "discoveredByAi"
> & { topicNames: string[] };

const demoEvents: EventCard[] = [
  {
    id: "demo-techno",
    title: "Noche techno independiente",
    description: "Evento ficticio para demostrar recomendaciones por genero y ciudad.",
    startsAt: new Date("2026-08-29T23:00:00-04:00"),
    city: "Santiago",
    region: "Metropolitana",
    venue: "Club de demostracion",
    address: "Bellavista, Santiago",
    latitude: -33.4327,
    longitude: -70.6357,
    locationPrecision: "approximate",
    status: "published",
    confidence: 100,
    sourceName: "Datos de demostracion",
    sourceUrl: "",
    imageUrl: "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=900&q=80",
    priceLabel: "$12.000",
    discoveredByAi: false,
    topicNames: ["Techno", "Musica electronica"],
  },
  {
    id: "demo-eva",
    title: "Encuentro de fans de Evangelion",
    description: "Actividad ficticia de comunidad con conversatorio e intercambio.",
    startsAt: new Date("2026-09-05T16:00:00-04:00"),
    city: "Santiago",
    region: "Metropolitana",
    venue: "Centro cultural de demostracion",
    address: "Providencia, Santiago",
    latitude: -33.4255,
    longitude: -70.6158,
    locationPrecision: "approximate",
    status: "published",
    confidence: 100,
    sourceName: "Datos de demostracion",
    sourceUrl: "",
    imageUrl: "https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&w=900&q=80",
    priceLabel: "Gratis",
    discoveredByAi: false,
    topicNames: ["Evangelion", "Anime"],
  },
  {
    id: "demo-valorant",
    title: "Copa comunitaria de Valorant",
    description: "Torneo ficticio abierto a equipos amateur de todo Chile.",
    startsAt: new Date("2026-09-12T14:00:00-04:00"),
    city: "Online",
    region: "Todo Chile",
    venue: "Discord",
    address: null,
    latitude: null,
    longitude: null,
    locationPrecision: "online",
    status: "published",
    confidence: 100,
    sourceName: "Datos de demostracion",
    sourceUrl: "",
    imageUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=900&q=80",
    priceLabel: "Gratis",
    discoveredByAi: false,
    topicNames: ["Valorant", "Gaming"],
  },
  {
    id: "demo-miku",
    title: "Hatsune Miku fan meetup",
    description: "Evento ficticio con cosplay, musica y arte de la comunidad.",
    startsAt: new Date("2026-10-03T15:30:00-03:00"),
    city: "Valparaiso",
    region: "Valparaiso",
    venue: "Paseo de demostracion",
    address: "Valparaiso",
    latitude: -33.0472,
    longitude: -71.6127,
    locationPrecision: "city",
    status: "published",
    confidence: 100,
    sourceName: "Datos de demostracion",
    sourceUrl: "",
    imageUrl: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80",
    priceLabel: "Gratis",
    discoveredByAi: false,
    topicNames: ["Hatsune Miku", "Anime"],
  },
];

export function eventKey(title: string, startsAt: Date, sourceUrl: string) {
  return createHash("sha256")
    .update(`${title.trim().toLocaleLowerCase("es-CL")}|${startsAt.toISOString()}|${sourceUrl.trim()}`)
    .digest("hex");
}

export async function listEvents(): Promise<{ events: EventCard[]; demo: boolean }> {
  if (!process.env.DATABASE_URL) return { events: demoEvents, demo: true };

  const db = getDb();
  const now = new Date();
  const rows = await db
    .select({ event: events, topicName: topics.name })
    .from(events)
    .leftJoin(eventTopics, eq(eventTopics.eventId, events.id))
    .leftJoin(topics, eq(topics.id, eventTopics.topicId))
    .where(and(eq(events.status, "published"), or(gt(events.startsAt, now), gte(events.endsAt, now))))
    .orderBy(asc(events.startsAt));

  const grouped = new Map<string, EventCard>();
  for (const row of rows) {
    const current = grouped.get(row.event.id) ?? { ...row.event, topicNames: [] };
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
  topicNames: string[];
  sourceName: string;
  sourceUrl: string;
  imageUrl?: string | null;
  confidence: number;
}) {
  const db = getDb();
  const externalKey = eventKey(candidate.title, candidate.startsAt, candidate.sourceUrl);
  const status = candidate.confidence >= 85 ? "published" : "pending";
  const { topicNames, ...event } = candidate;
  const [saved] = await db
    .insert(events)
    .values({ ...event, externalKey, status, discoveredByAi: true, verifiedAt: new Date() })
    .onConflictDoUpdate({
      target: events.externalKey,
      set: { ...event, status, updatedAt: new Date() },
    })
    .returning({ id: events.id });

  for (const name of topicNames) {
    const slug = name.toLocaleLowerCase("es-CL").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const [topic] = await db
      .insert(topics)
      .values({ name, slug, type: "interest" })
      .onConflictDoUpdate({ target: topics.slug, set: { name } })
      .returning({ id: topics.id });
    await db.insert(eventTopics).values({ eventId: saved.id, topicId: topic.id }).onConflictDoNothing();
  }
  return status;
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
