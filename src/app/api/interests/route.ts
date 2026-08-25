import { inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { topics, userInterests } from "@/db/schema";
import { currentUser } from "@/lib/current-user";
import { topicSlug } from "@/lib/taxonomy";

const schema = z.object({ topicIds: z.array(z.number().int().positive()).max(50), customInterests: z.array(z.object({ name: z.string().trim().min(2).max(80).refine((name) => Boolean(topicSlug(name))), type: z.enum(["artist", "topic"]) })).max(20).default([]) });

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid interests" }, { status: 400 });
  const db = getDb();
  const customBySlug = new Map(parsed.data.customInterests.map((interest) => [topicSlug(interest.name), { ...interest, name: interest.name.replace(/\s+/g, " ").trim() }]));
  if (parsed.data.topicIds.length + customBySlug.size > 50) return NextResponse.json({ error: "Puedes guardar hasta 50 señales." }, { status: 400 });
  const customSlugs = [...customBySlug.keys()].filter(Boolean);
  const customTopics = customSlugs.length ? await db.transaction(async (tx) => {
    await tx.insert(topics).values(customSlugs.map((slug) => ({ ...customBySlug.get(slug)!, slug, searchEnabled: false }))).onConflictDoNothing();
    return tx.select({ id: topics.id }).from(topics).where(inArray(topics.slug, customSlugs));
  }) : [];
  const requestedIds = [...new Set([...parsed.data.topicIds, ...customTopics.map((topic) => topic.id)])];
  const valid = requestedIds.length ? await db.select({ id: topics.id }).from(topics).where(inArray(topics.id, requestedIds)) : [];
  await db.transaction(async (tx) => {
    await tx.delete(userInterests).where(inArray(userInterests.userId, [user.id]));
    if (valid.length) await tx.insert(userInterests).values(valid.map((topic) => ({ userId: user.id, topicId: topic.id })));
  });
  return NextResponse.json({ saved: valid.length, topicIds: valid.map((topic) => topic.id) });
}
