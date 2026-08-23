import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "@/db";
import { events } from "@/db/schema";
import { currentUser } from "@/lib/current-user";
import { ModerationList } from "@/components/ModerationList";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await currentUser();
  if (user?.role !== "admin") return <main className="form-page"><div className="form-card success-card"><h1>Acceso restringido</h1><Link href="/">Volver</Link></div></main>;
  const pending = await getDb().select({ id: events.id, title: events.title, city: events.city, startsAt: events.startsAt, sourceUrl: events.sourceUrl, sourceName: events.sourceName }).from(events).where(eq(events.status, "pending")).orderBy(asc(events.startsAt));
  return <main className="admin-page"><header><div><span>CONTROL DE CALIDAD</span><h1>Moderación</h1></div><Link href="/">Volver a la app</Link></header><ModerationList initialEvents={pending} /></main>;
}
