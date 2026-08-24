import { eq, or } from "drizzle-orm";
import { getDb } from "./index";
import { users } from "./schema";
import { hashPassword } from "../lib/passwords";
import { ensureCanonicalTaxonomy } from "../lib/taxonomy";

await ensureCanonicalTaxonomy();

const email = "admin@datito.local";
const password = process.env.ADMIN_PASSWORD;
if (password) {
  if (password.length < 12) throw new Error("ADMIN_PASSWORD must contain at least 12 characters");
  const db = getDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(or(eq(users.email, email), eq(users.credentialEmail, email))).limit(1);
  const values = { name: "Administrador", email, credentialEmail: email, passwordHash: await hashPassword(password), role: "admin" };
  if (existing) await db.update(users).set(values).where(eq(users.id, existing.id));
  else await db.insert(users).values(values);
}

console.log(`Seeded canonical taxonomy${password ? " and admin account" : ""}`);
process.exit(0);
