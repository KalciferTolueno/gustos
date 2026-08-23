import { getDb } from "./index";
import { topics } from "./schema";

const initialTopics = [
  ["Anime", "anime", "category"],
  ["Evangelion", "evangelion", "franchise"],
  ["Hatsune Miku", "hatsune-miku", "artist"],
  ["Musica electronica", "musica-electronica", "category"],
  ["Techno", "techno", "genre"],
  ["Charlotte de Witte", "charlotte-de-witte", "artist"],
  ["Gaming", "gaming", "category"],
  ["Valorant", "valorant", "game"],
  ["League of Legends", "league-of-legends", "game"],
] as const;

const db = getDb();
for (const [name, slug, type] of initialTopics) {
  await db.insert(topics).values({ name, slug, type }).onConflictDoNothing();
}
console.log(`Seeded ${initialTopics.length} topics`);
process.exit(0);
