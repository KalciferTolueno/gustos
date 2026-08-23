import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { topics, userInterests } from "@/db/schema";
import { currentUser } from "@/lib/current-user";
import { InterestPicker } from "@/components/InterestPicker";

export const dynamic = "force-dynamic";

export default async function InterestsPage() {
  const user = await currentUser();
  if (!user) return <main className="form-page"><div className="form-card success-card"><h1>Inicia sesión</h1><p>Guarda tus gustos y úsalos en todos tus dispositivos.</p><Link href="/login">Entrar</Link></div></main>;
  const db = getDb();
  const [allTopics, selected] = await Promise.all([
    db.select({ id: topics.id, name: topics.name, type: topics.type }).from(topics).orderBy(asc(topics.name)),
    db.select({ id: userInterests.topicId }).from(userInterests).where(eq(userInterests.userId, user.id)),
  ]);
  return <InterestPicker topics={allTopics} initial={selected.map((topic) => topic.id)} />;
}
