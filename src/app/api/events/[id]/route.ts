import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { events } from "@/db/schema";
import { currentUser } from "@/lib/current-user";

const actionSchema = z.object({ action: z.enum(["approve", "reject"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  const { id } = await params;
  const [updated] = await getDb().update(events).set({
    status: parsed.data.action === "approve" ? "published" : "rejected",
    confidence: parsed.data.action === "approve" ? 100 : 0,
    verifiedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(events.id, id)).returning({ id: events.id });
  return updated ? NextResponse.json(updated) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
