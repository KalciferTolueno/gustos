import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runDiscoveryAgent } from "@/lib/agent";

export async function POST(request: Request) {
  const expected = process.env.AGENT_RUN_SECRET;
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !received) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runDiscoveryAgent());
}
