import Link from "next/link";
import { currentUser } from "@/lib/current-user";
import { SubmitEventForm } from "@/components/SubmitEventForm";

export const dynamic = "force-dynamic";

export default async function SubmitPage() {
  const user = await currentUser();
  if (!user) return (
    <main className="form-page"><div className="form-card success-card"><h1>Inicia sesión</h1><p>Necesitas una cuenta para enviar eventos y evitar spam.</p><Link href="/login">Entrar o crear cuenta</Link><Link className="subtle-link" href="/">Volver</Link></div></main>
  );
  return <SubmitEventForm />;
}
