import { eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { eventTopics, events, topics } from "../db/schema";

export const categorySlugs = [
  "gaming", "anime", "cine", "musica", "fotografia", "astrofotografia", "viajes", "arte-cultura",
  "teatro-danza", "comedia", "literatura", "gastronomia-ferias", "deportes-bienestar", "tecnologia-ciencia",
  "familia", "comunidad",
] as const;

export type CategorySlug = typeof categorySlugs[number];

export const categoryNames: Record<CategorySlug, string> = {
  gaming: "Gaming",
  anime: "Anime",
  cine: "Cine y películas",
  musica: "Música",
  fotografia: "Fotografía",
  astrofotografia: "Astrofotografía",
  viajes: "Viajes y tours",
  "arte-cultura": "Arte y cultura",
  "teatro-danza": "Teatro y danza",
  comedia: "Comedia",
  literatura: "Literatura",
  "gastronomia-ferias": "Gastronomía y ferias",
  "deportes-bienestar": "Deportes y bienestar",
  "tecnologia-ciencia": "Tecnología y ciencia",
  familia: "Familia",
  comunidad: "Comunidad",
};

const legacyCategories: Record<string, CategorySlug> = {
  arte: "arte-cultura",
  convencion: "comunidad",
  deportes: "deportes-bienestar",
  fiesta: "comunidad",
  "musica-electronica": "musica",
};

const canonicalTopics: Array<[string, string, CategorySlug, string]> = [
  ["Esports", "esports", "gaming", "activity"], ["Torneos de videojuegos", "torneos-videojuegos", "gaming", "activity"], ["Juegos de mesa y TCG", "juegos-mesa-tcg", "gaming", "activity"], ["Game jams y LAN", "game-jams-lan", "gaming", "activity"],
  ["Convenciones de anime", "convenciones-anime", "anime", "activity"], ["Cosplay", "cosplay", "anime", "activity"], ["Encuentros de fans", "encuentros-fans", "anime", "activity"],
  ["Cine independiente", "cine-independiente", "cine", "genre"], ["Festivales de cine", "festivales-cine", "cine", "activity"], ["Ciclos y funciones especiales", "ciclos-cine", "cine", "activity"],
  ["Urbano y reggaetón", "urbano-reggaeton", "musica", "genre"], ["Cumbia y tropical", "cumbia-tropical", "musica", "genre"], ["Electrónica y techno", "electronica-techno", "musica", "genre"], ["Rock e indie", "rock-indie", "musica", "genre"], ["Metal, punk y hardcore", "metal-punk-hardcore", "musica", "genre"], ["Pop y K-pop", "pop-kpop", "musica", "genre"], ["Jazz, blues y soul", "jazz-blues-soul", "musica", "genre"], ["Clásica y ópera", "clasica-opera", "musica", "genre"], ["Folclore y música latina", "folclore-latina", "musica", "genre"], ["Experimental y ambient", "experimental-ambient", "musica", "genre"],
  ["Exposiciones fotográficas", "exposiciones-fotograficas", "fotografia", "activity"], ["Talleres de fotografía", "talleres-fotografia", "fotografia", "activity"], ["Photo walks y concursos", "photo-walks-concursos", "fotografia", "activity"],
  ["Tours de astrofotografía", "tours-astrofotografia", "astrofotografia", "activity"], ["Observación astronómica", "observacion-astronomica", "astrofotografia", "activity"],
  ["Naturaleza y aventura", "naturaleza-aventura", "viajes", "activity"], ["Tours culturales", "tours-culturales", "viajes", "activity"], ["Nieve, termas y montaña", "nieve-termas-montana", "viajes", "activity"], ["Rutas del vino y gastronomía", "vino-gastronomia", "viajes", "activity"], ["Viajes de varios días", "viajes-varios-dias", "viajes", "activity"], ["Mendoza y viajes internacionales", "mendoza-internacionales", "viajes", "activity"],
  ["Museos y exposiciones", "museos-exposiciones", "arte-cultura", "activity"], ["Artesanía y patrimonio", "artesania-patrimonio", "arte-cultura", "activity"],
  ["Teatro", "teatro", "teatro-danza", "activity"], ["Danza", "danza", "teatro-danza", "activity"], ["Musicales", "musicales", "teatro-danza", "activity"],
  ["Stand-up", "stand-up", "comedia", "activity"], ["Improvisación", "improvisacion", "comedia", "activity"],
  ["Ferias del libro", "ferias-libro", "literatura", "activity"], ["Lanzamientos y clubes de lectura", "lanzamientos-clubes-lectura", "literatura", "activity"],
  ["Ferias gastronómicas", "ferias-gastronomicas", "gastronomia-ferias", "activity"], ["Mercados y festivales", "mercados-festivales", "gastronomia-ferias", "activity"],
  ["Competencias deportivas", "competencias-deportivas", "deportes-bienestar", "activity"], ["Outdoor y trekking", "outdoor-trekking", "deportes-bienestar", "activity"], ["Yoga y bienestar", "yoga-bienestar", "deportes-bienestar", "activity"],
  ["Tecnología e innovación", "tecnologia-innovacion", "tecnologia-ciencia", "activity"], ["Ciencia y astronomía", "ciencia-astronomia", "tecnologia-ciencia", "activity"],
  ["Infantil y familiar", "infantil-familiar", "familia", "activity"], ["Fiestas y encuentros", "fiestas-encuentros", "comunidad", "activity"], ["Convenciones y comunidades", "convenciones-comunidades", "comunidad", "activity"],
];

export function topicSlug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CL").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function ensureCanonicalTaxonomy() {
  const db = getDb();
  const categoryIds = new Map<CategorySlug, number>();
  for (const slug of categorySlugs) {
    const [category] = await db.insert(topics).values({ name: categoryNames[slug], slug, type: "category", searchEnabled: true }).onConflictDoUpdate({ target: topics.slug, set: { name: categoryNames[slug], type: "category", searchEnabled: true } }).returning({ id: topics.id });
    categoryIds.set(slug, category.id);
  }
  for (const [name, slug, parentSlug, type] of canonicalTopics) {
    await db.insert(topics).values({ name, slug, type, parentId: categoryIds.get(parentSlug), searchEnabled: true }).onConflictDoUpdate({ target: topics.slug, set: { name, type, parentId: categoryIds.get(parentSlug), searchEnabled: true } });
  }
  const rows = await db.select({ eventId: events.id, topicId: topics.id, parentId: topics.parentId, slug: topics.slug, type: topics.type }).from(events).innerJoin(eventTopics, eq(eventTopics.eventId, events.id)).innerJoin(topics, eq(topics.id, eventTopics.topicId)).where(isNull(events.categoryId));
  const categoryByEvent = new Map<string, number>();
  for (const row of rows) {
    const canonical = categorySlugs.includes(row.slug as CategorySlug) ? categoryIds.get(row.slug as CategorySlug) : undefined;
    const legacy = legacyCategories[row.slug];
    const id = canonical ?? row.parentId ?? (legacy ? categoryIds.get(legacy) : undefined);
    if (id && (canonical || !categoryByEvent.has(row.eventId))) categoryByEvent.set(row.eventId, id);
  }
  for (const [eventId, id] of categoryByEvent) await db.update(events).set({ categoryId: id }).where(eq(events.id, eventId));
  return categoryIds;
}
