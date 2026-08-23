import { inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { topics, userInterests } from "@/db/schema";
import { currentUser } from "@/lib/current-user";

const schema = z.object({ topicIds: z.array(z.number().int().positive()).max(50) });

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid interests" }, { status: 400 });
  const db = getDb();
  const valid = parsed.data.topicIds.length
    ? await db.select({ id: topics.id }).from(topics).where(inArray(topics.id, parsed.data.topicIds))
    : [];
  await db.transaction(async (tx) => {
    await tx.delete(userInterests).where(inArray(userInterests.userId, [user.id]));
    if (valid.length) await tx.insert(userInterests).values(valid.map((topic) => ({ userId: user.id, topicId: topic.id })));
  });
  return NextResponse.json({ saved: valid.length });
}
