import { listEvents } from "@/lib/events";
import { Dashboard } from "@/components/Dashboard";
import { auth } from "@/auth";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { topics, userInterests, users } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [data, session] = await Promise.all([listEvents(), auth()]);
  const [interestTopics, selectedInterests, viewer] = process.env.DATABASE_URL && session?.user?.id
    ? await Promise.all([
      getDb().select({ id: topics.id, name: topics.name, slug: topics.slug, type: topics.type, parentId: topics.parentId, searchEnabled: topics.searchEnabled }).from(topics).orderBy(asc(topics.name)),
      getDb().select({ id: userInterests.topicId }).from(userInterests).where(eq(userInterests.userId, session.user.id)),
      getDb().select({ role: users.role }).from(users).where(eq(users.id, session.user.id)).limit(1).then(([user]) => user ?? null),
    ])
    : [[], [], null];
  return <Dashboard
    {...data}
    signedIn={Boolean(session?.user?.id)}
    isAdmin={viewer?.role === "admin"}
    userName={session?.user?.name ?? session?.user?.email}
    interestTopics={interestTopics}
    initialInterests={selectedInterests.map((topic) => topic.id)}
    google={Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)}
    discord={Boolean(process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET)}
  />;
}
