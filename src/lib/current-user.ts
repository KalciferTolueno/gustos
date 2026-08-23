import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export async function currentUser() {
  const session = await auth();
  if (!session?.user?.id || !process.env.DATABASE_URL) return null;
  const [user] = await getDb().select().from(users).where(eq(users.id, session.user.id)).limit(1);
  return user ?? null;
}
