import { NextResponse } from "next/server";
import { auditExistingEvents } from "@/lib/catalog-audit";
import { currentUser } from "@/lib/current-user";
import { isAgentPaused } from "@/lib/agent-control";

export async function POST() {
  const user = await currentUser();
  if (user?.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  if (await isAgentPaused()) return NextResponse.json({ error: "El uso de créditos está en pausa." }, { status: 409 });
  try {
    return NextResponse.json(await auditExistingEvents(1));
  } catch (error) {
    console.error("Manual catalog audit failed", error);
    return NextResponse.json({ error: "No fue posible completar la auditoría" }, { status: 500 });
  }
}
