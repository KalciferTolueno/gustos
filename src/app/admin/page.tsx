import { and, asc, desc, eq, gt, gte, lt, or, sql } from "drizzle-orm";
import Link from "next/link";
import { CatalogAuditControl } from "@/components/CatalogAuditControl";
import { ModerationList } from "@/components/ModerationList";
import { getDb } from "@/db";
import { agentRuns, discoveryQueries, events, searchRequests } from "@/db/schema";
import { currentUser } from "@/lib/current-user";
import { CATALOG_AUDIT_VERSION } from "@/lib/catalog-audit";

export const dynamic = "force-dynamic";

const formatDate = (date: Date | null) => date ? new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short", timeZone: "America/Santiago" }).format(date) : "-";

export default async function AdminPage() {
  const user = await currentUser();
  if (user?.role !== "admin") return <main id="main-content" className="form-page"><div className="form-card success-card"><h1>Acceso Restringido</h1><Link href="/">Volver</Link></div></main>;
  const db = getDb();
  const now = new Date();
  const [pending, [usage], coverage, recentRuns, recentSearches, [auditProgress]] = await Promise.all([
    db.select({ id: events.id, title: events.title, city: events.city, startsAt: events.startsAt, sourceUrl: events.sourceUrl, sourceName: events.sourceName }).from(events).where(eq(events.status, "pending")).orderBy(asc(events.startsAt)),
    db.select({ searches: sql<number>`coalesce(sum(${agentRuns.searches}), 0)`, inputTokens: sql<number>`coalesce(sum(${agentRuns.inputTokens}), 0)`, outputTokens: sql<number>`coalesce(sum(${agentRuns.outputTokens}), 0)`, cost: sql<number>`coalesce(sum(${agentRuns.estimatedCostMicros}), 0)` }).from(agentRuns),
    db.select({ category: discoveryQueries.categorySlug, region: discoveryQueries.region, status: discoveryQueries.status }).from(discoveryQueries).where(eq(discoveryQueries.kind, "coverage")),
    db.select().from(agentRuns).orderBy(desc(agentRuns.startedAt)).limit(20),
    db.select({ query: discoveryQueries.displayQuery, cacheHit: searchRequests.cacheHit, searches: searchRequests.searches, resultCount: searchRequests.resultCount, status: searchRequests.status, createdAt: searchRequests.createdAt }).from(searchRequests).leftJoin(discoveryQueries, eq(discoveryQueries.id, searchRequests.queryId)).orderBy(desc(searchRequests.createdAt)).limit(20),
    db.select({ remaining: sql<number>`count(*)` }).from(events).where(and(
      eq(events.status, "published"),
      lt(events.catalogAuditVersion, CATALOG_AUDIT_VERSION),
      or(gt(events.startsAt, now), gte(events.endsAt, now), eq(events.eventState, "postponed")),
    )),
  ]);
  const coverageTotal = coverage.length;
  const coverageReady = coverage.filter((row) => row.status === "ready").length;
  const progress = (key: "category" | "region") => [...new Set(coverage.map((row) => row[key]).filter((value): value is string => Boolean(value)))].sort().map((name) => {
    const rows = coverage.filter((row) => row[key] === name);
    return { name, ready: rows.filter((row) => row.status === "ready").length, total: rows.length };
  });

  return <main id="main-content" className="min-h-screen bg-[#0b0c0e] px-4 py-8 text-zinc-100 sm:px-8">
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="flex items-end justify-between gap-4"><div><span className="text-xs tracking-[.2em] text-emerald-400">CONTROL DE CALIDAD</span><h1 className="mt-2 text-3xl font-semibold">Administración</h1></div><Link href="/" className="text-sm text-zinc-400 hover:text-white">Volver a la app</Link></header>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[["Búsquedas web", usage.searches], ["Tokens entrada", usage.inputTokens], ["Tokens salida", usage.outputTokens], ["Costo estimado", `$${(Number(usage.cost) / 1_000_000).toFixed(2)}`], ["Cobertura", `${coverageReady}/${coverageTotal}`]].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[.04] p-5"><p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p><strong className="mt-2 block text-2xl">{String(value)}</strong></div>)}
      </section>
      <CatalogAuditControl version={CATALOG_AUDIT_VERSION} initialRemaining={Number(auditProgress.remaining)} />
      <section className="grid gap-6 xl:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-white/10"><h2 className="border-b border-white/10 p-4 font-medium">Ejecuciones Recientes</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Últimas ejecuciones del agente de descubrimiento</caption><thead className="text-zinc-500"><tr><th scope="col" className="p-3">Fecha</th><th scope="col">Estado</th><th scope="col">Tipo</th><th scope="col">Búsquedas</th><th scope="col">Resultados</th></tr></thead><tbody>{recentRuns.map((run) => <tr key={run.id} className="border-t border-white/5"><td className="p-3 text-zinc-400">{formatDate(run.startedAt)}</td><td>{run.status}</td><td>{run.kind}</td><td>{run.searches}</td><td>{run.published}</td></tr>)}</tbody></table></div></div>
        <div className="overflow-hidden rounded-2xl border border-white/10"><h2 className="border-b border-white/10 p-4 font-medium">Búsquedas de Usuarios</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Últimas búsquedas realizadas por usuarios</caption><thead className="text-zinc-500"><tr><th scope="col" className="p-3">Fecha</th><th scope="col">Consulta</th><th scope="col">Estado</th><th scope="col">Resultados</th></tr></thead><tbody>{recentSearches.map((search, index) => <tr key={`${search.createdAt.toISOString()}-${index}`} className="border-t border-white/5"><td className="p-3 text-zinc-400">{formatDate(search.createdAt)}</td><td className="max-w-56 truncate">{search.query ?? "-"}{search.cacheHit ? " (caché)" : ""}</td><td>{search.status}</td><td>{search.resultCount}</td></tr>)}</tbody></table></div></div>
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        {([["Cobertura por categoría", progress("category")], ["Cobertura por región", progress("region")]] as const).map(([title, rows]) => <div key={title} className="rounded-2xl border border-white/10 p-5"><h2 className="mb-4 font-medium">{title}</h2><div className="grid gap-2 sm:grid-cols-2">{rows.map((row) => <div key={row.name} className="flex justify-between gap-3 text-sm"><span className="truncate text-zinc-400">{row.name}</span><span>{row.ready}/{row.total}</span></div>)}</div></div>)}
      </section>
      <section><h2 className="mb-4 text-xl font-medium">Moderación pendiente ({pending.length})</h2><ModerationList initialEvents={pending} /></section>
    </div>
  </main>;
}
