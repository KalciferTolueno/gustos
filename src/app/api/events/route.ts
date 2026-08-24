import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { events, eventSources } from "@/db/schema";
import { currentUser } from "@/lib/current-user";
import { eventIdentityKey, eventKey, normalizedSourceUrl } from "@/lib/events";

const submissionSchema = z.object({
  title: z.string().trim().min(4).max(160),
  description: z.string().trim().min(20).max(2000),
  startsAt: z.iso.datetime({ offset: true }),
  city: z.string().trim().min(2).max(80),
  region: z.string().trim().min(2).max(80),
  venue: z.string().trim().max(160).optional(),
  address: z.string().trim().max(250).optional(),
  sourceUrl: z.url().max(1000),
  topic: z.string().trim().min(2).max(80),
});

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });
  const parsed = submissionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Revisa los datos", details: parsed.error.flatten() }, { status: 400 });

  const startsAt = new Date(parsed.data.startsAt);
  if (startsAt <= new Date()) return NextResponse.json({ error: "La fecha debe ser futura" }, { status: 400 });
  const { topic, ...data } = parsed.data;
  const saved = await getDb().transaction(async (tx) => {
    const [event] = await tx.insert(events).values({
      ...data,
      startsAt,
      externalKey: eventKey(data.title, startsAt, data.sourceUrl, data.venue, data.city),
      identityKey: eventIdentityKey(data.title, startsAt, data.city, data.venue),
      sourceName: `Comunidad · ${topic}`,
      status: "pending",
      submittedBy: user.id,
    }).onConflictDoNothing().returning({ id: events.id });
    if (event) await tx.insert(eventSources).values({ eventId: event.id, name: `Comunidad · ${topic}`, url: data.sourceUrl, normalizedUrl: normalizedSourceUrl(data.sourceUrl), isPrimary: true });
    return event;
  });

  if (!saved) return NextResponse.json({ error: "Este evento ya fue enviado" }, { status: 409 });
  return NextResponse.json({ id: saved.id }, { status: 201 });
}
