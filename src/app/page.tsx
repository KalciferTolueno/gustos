import { listEvents } from "@/lib/events";
import { Dashboard } from "@/components/Dashboard";
import { auth } from "@/auth";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { topics, userInterests } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [data, session] = await Promise.all([listEvents(), auth()]);
  const [interestTopics, selectedInterests] = process.env.DATABASE_URL && session?.user?.id
    ? await Promise.all([
      getDb().select({ id: topics.id, name: topics.name, type: topics.type }).from(topics).orderBy(asc(topics.name)),
      getDb().select({ id: userInterests.topicId }).from(userInterests).where(eq(userInterests.userId, session.user.id)),
    ])
    : [[], []];
  return <Dashboard
    {...data}
    signedIn={Boolean(session?.user?.id)}
    userName={session?.user?.name ?? session?.user?.email}
    interestTopics={interestTopics}
    initialInterests={selectedInterests.map((topic) => topic.id)}
    google={Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)}
    discord={Boolean(process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET)}
  />;
}
