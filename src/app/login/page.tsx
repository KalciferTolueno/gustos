import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { EmailAuthForm } from "@/components/EmailAuthForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await auth()) redirect("/gustos");
  return <EmailAuthForm google={Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)} discord={Boolean(process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET)} />;
}
