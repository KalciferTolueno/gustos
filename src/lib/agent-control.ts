import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { agentControls } from "../db/schema";

const controlsId = "global";

export async function isAgentPaused() {
  if (!process.env.DATABASE_URL) return false;
  const [controls] = await getDb().select({ paused: agentControls.paused }).from(agentControls).where(eq(agentControls.id, controlsId)).limit(1);
  return controls?.paused ?? false;
}

export async function setAgentPaused(paused: boolean) {
  const [controls] = await getDb().insert(agentControls).values({ id: controlsId, paused, updatedAt: new Date() }).onConflictDoUpdate({
    target: agentControls.id,
    set: { paused, updatedAt: new Date() },
  }).returning({ paused: agentControls.paused, updatedAt: agentControls.updatedAt });
  return controls;
}
