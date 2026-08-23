import { NextResponse } from "next/server";
import { z } from "zod";
import { runDiscoveryAgent } from "@/lib/agent";
import { completeQuery, queryEventIds, queryIsFresh, recordDiscoveryQuery } from "@/lib/discovery-queries";
import { matchesEventSearch } from "@/lib/event-search";
import { listEvents } from "@/lib/events";
import { allowAuthAttempt, requestIp } from "@/lib/rate-limit";

const schema = z.object({ query: z.string().trim().min(2).max(80) });

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL || !process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "La búsqueda web no está disponible." }, { status: 503 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Escribe al menos 2 caracteres." }, { status: 400 });
  const query = await recordDiscoveryQuery(parsed.data.query);
  if (!query.lastRefreshedAt) {
    const eventIds = (await listEvents()).events.filter((event) => matchesEventSearch(event, parsed.data.query)).map((event) => event.id);
    if (eventIds.length) {
      await completeQuery(query.id, eventIds, query.kind);
      return NextResponse.json({ cached: true, skipped: false, published: eventIds.length, searches: 0, eventIds });
    }
  }
  if (queryIsFresh(query)) {
    const eventIds = await queryEventIds(query.id);
    return NextResponse.json({ cached: true, skipped: false, published: eventIds.length, searches: 0, eventIds });
  }
  if (!allowAuthAttempt(`discover-ip:${requestIp(request)}`, 3, 60 * 60_000)) {
    return NextResponse.json({ error: "Alcanzaste el límite de búsquedas. Intenta más tarde." }, { status: 429 });
  }

  try {
    return NextResponse.json(await runDiscoveryAgent(query.displayQuery, query.id, query.kind));
  } catch (error) {
    console.error("Guest discovery failed", error);
    return NextResponse.json({ error: "No pudimos completar la búsqueda web." }, { status: 502 });
  }
}
