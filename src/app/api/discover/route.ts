import { NextResponse } from "next/server";
import { z } from "zod";
import { runDiscoveryAgent } from "@/lib/agent";
import { allowAuthAttempt, requestIp } from "@/lib/rate-limit";

const schema = z.object({ query: z.string().trim().min(2).max(80) });

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL || !process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "La búsqueda web no está disponible." }, { status: 503 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Escribe al menos 2 caracteres." }, { status: 400 });
  if (!allowAuthAttempt(`discover-ip:${requestIp(request)}`, 3, 60 * 60_000)) {
    return NextResponse.json({ error: "Alcanzaste el límite de búsquedas. Intenta más tarde." }, { status: 429 });
  }

  try {
    return NextResponse.json(await runDiscoveryAgent(parsed.data.query));
  } catch (error) {
    console.error("Guest discovery failed", error);
    return NextResponse.json({ error: "No pudimos completar la búsqueda web." }, { status: 502 });
  }
}
