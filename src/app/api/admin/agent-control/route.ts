import { NextResponse } from "next/server";
import { z } from "zod";
import { setAgentPaused } from "@/lib/agent-control";
import { currentUser } from "@/lib/current-user";

const controlsSchema = z.object({ paused: z.boolean() });

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (user?.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = controlsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Estado de pausa inválido" }, { status: 400 });
  return NextResponse.json(await setAgentPaused(parsed.data.paused));
}
