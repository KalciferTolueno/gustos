import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { searchRequests } from "@/db/schema";
import { runDiscoveryAgent } from "@/lib/agent";
import { currentUser } from "@/lib/current-user";
import { completeQuery, queryEventIds, queryIsFresh, recordDiscoveryQuery } from "@/lib/discovery-queries";
import { matchesEventSearch } from "@/lib/event-search";
import { listEvents } from "@/lib/events";
import { allowAuthAttempt, requesterHash, requestIp } from "@/lib/rate-limit";
import { isAgentPaused } from "@/lib/agent-control";

const schema = z.object({ query: z.string().trim().min(2).max(80) });

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL || !process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "La búsqueda web no está disponible." }, { status: 503 });
  }
  if (await isAgentPaused()) return NextResponse.json({ error: "La búsqueda web está pausada temporalmente." }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Escribe al menos 2 caracteres." }, { status: 400 });
  const query = await recordDiscoveryQuery(parsed.data.query);
  const user = await currentUser();
  const record = (values: { cacheHit?: boolean; searches?: number; resultCount?: number; status?: string }) => getDb().insert(searchRequests).values({
    queryId: query.id,
    userId: user?.id,
    requesterHash: requesterHash(request),
    ...values,
  });
  if (!query.lastRefreshedAt) {
    const eventIds = (await listEvents()).events.filter((event) => matchesEventSearch(event, parsed.data.query)).map((event) => event.id);
    if (eventIds.length) {
      await completeQuery(query.id, eventIds, query.kind);
      await record({ cacheHit: true, resultCount: eventIds.length });
      return NextResponse.json({ cached: true, skipped: false, published: eventIds.length, searches: 0, eventIds });
    }
  }
  if (queryIsFresh(query)) {
    const eventIds = await queryEventIds(query.id);
    await record({ cacheHit: true, resultCount: eventIds.length });
    return NextResponse.json({ cached: true, skipped: false, published: eventIds.length, searches: 0, eventIds });
  }
  if (!allowAuthAttempt(`discover-ip:${requestIp(request)}`, 3, 60 * 60_000)) {
    await record({ status: "rate_limited" });
    return NextResponse.json({ error: "Alcanzaste el límite de búsquedas. Intenta más tarde." }, { status: 429 });
  }

  try {
    const result = await runDiscoveryAgent(query.displayQuery, query.id, query.kind);
    await record({ searches: result.skipped ? 0 : result.searches, resultCount: result.skipped ? 0 : result.published, status: result.skipped ? result.reason : "succeeded" });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Guest discovery failed", error);
    await record({ status: "failed" });
    return NextResponse.json({ error: "No pudimos completar la búsqueda web." }, { status: 502 });
  }
}
