import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Discord from "next-auth/providers/discord";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { verifyPassword } from "@/lib/passwords";
import { allowAuthAttempt, requestIp } from "@/lib/rate-limit";

const providers: NextAuthConfig["providers"] = [];
providers.push(Credentials({
  name: "Correo y contraseña",
  credentials: {
    email: { label: "Correo", type: "email" },
    password: { label: "Contraseña", type: "password" },
  },
  async authorize(credentials, request) {
    if (!process.env.DATABASE_URL) return null;
    const parsed = z.object({ email: z.email(), password: z.string().min(1).max(200) }).safeParse(credentials);
    if (!parsed.success) return null;
    const email = parsed.data.email.trim().toLocaleLowerCase("es-CL");
    if (!allowAuthAttempt(`login-ip:${requestIp(request)}`) || !allowAuthAttempt(`login-email:${email}`)) return null;
    const [user] = await getDb().select().from(users).where(eq(users.credentialEmail, email)).limit(1);
    const valid = await verifyPassword(
      parsed.data.password,
      user?.passwordHash ?? `scrypt$32768$8$1$${"00".repeat(16)}$${"00".repeat(64)}`,
    );
    if (!user || !valid) return null;
    return { id: user.id, name: user.name, email: user.email, image: user.image };
  },
}));
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET }));
}
if (process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET) {
  providers.push(Discord({ clientId: process.env.AUTH_DISCORD_ID, clientSecret: process.env.AUTH_DISCORD_SECRET }));
}

export const { handlers, auth } = NextAuth({
  adapter: process.env.DATABASE_URL
    ? DrizzleAdapter(getDb(), { usersTable: users, accountsTable: accounts, sessionsTable: sessions, verificationTokensTable: verificationTokens })
    : undefined,
  providers,
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    session({ session, token }) {
      const id = token.userId ?? token.sub;
      if (session.user && id) session.user.id = String(id);
      return session;
    },
  },
  trustHost: true,
});
