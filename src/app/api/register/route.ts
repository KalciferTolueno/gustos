import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/passwords";
import { allowAuthAttempt, requestIp } from "@/lib/rate-limit";

const registrationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().max(254),
  password: z.string()
    .min(12)
    .max(200)
    .regex(/[a-zA-Z]/)
    .regex(/[0-9]/),
});

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Registro no disponible" }, { status: 503 });
  const body = await request.json().catch(() => null);
  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Usa un nombre válido y una contraseña de 12 caracteres con letras y números." }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLocaleLowerCase("es-CL");
  if (!allowAuthAttempt(`register-ip:${requestIp(request)}`, 5, 60 * 60_000)
    || !allowAuthAttempt(`register-email:${email}`, 3, 60 * 60_000)) {
    return NextResponse.json({ error: "Demasiados intentos. Intenta más tarde." }, { status: 429 });
  }
  const db = getDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.credentialEmail, email)).limit(1);
  if (existing) return NextResponse.json({ error: "No se pudo crear la cuenta con esos datos." }, { status: 409 });

  try {
    await db.insert(users).values({
      name: parsed.data.name,
      credentialEmail: email,
      passwordHash: await hashPassword(parsed.data.password),
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "No se pudo crear la cuenta con esos datos." }, { status: 409 });
    }
    throw error;
  }
  return NextResponse.json({ created: true }, { status: 201 });
}
