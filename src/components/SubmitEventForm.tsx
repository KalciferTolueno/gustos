"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle2, Send } from "lucide-react";
import Link from "next/link";

export function SubmitEventForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setState("sending");
    const date = new Date(String(formData.get("startsAt")));
    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries([...formData, ["startsAt", date.toISOString()]])),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "No pudimos enviar el evento");
      setState("error");
      return;
    }
    setState("sent");
  }

  if (state === "sent") return (
    <main className="form-page"><div className="form-card success-card"><CheckCircle2 /><h1>Evento recibido</h1><p>Lo revisaremos antes de publicarlo.</p><Link href="/">Volver a explorar</Link></div></main>
  );

  return (
    <main className="form-page">
      <div className="form-card">
        <Link href="/" className="back-link"><ArrowLeft size={16} /> Volver</Link>
        <span className="form-kicker">APORTE COMUNITARIO</span>
        <h1>Comparte un evento</h1>
        <p>Incluye una fuente pública para que podamos verificarlo.</p>
        <form action={submit}>
          <label>Título<input name="title" required minLength={4} maxLength={160} /></label>
          <label>Descripción<textarea name="description" required minLength={20} maxLength={2000} rows={4} /></label>
          <div className="form-grid"><label>Fecha y hora<input name="startsAt" type="datetime-local" required /></label><label>Gusto o categoría<input name="topic" placeholder="Techno, Valorant..." required /></label></div>
          <div className="form-grid"><label>Ciudad<input name="city" required /></label><label>Región<input name="region" required /></label></div>
          <div className="form-grid"><label>Lugar<input name="venue" /></label><label>Dirección exacta<input name="address" /></label></div>
          <label>Enlace de la publicación<input name="sourceUrl" type="url" placeholder="https://..." required /></label>
          {state === "error" && <div className="form-error">{error}</div>}
          <button disabled={state === "sending"}><Send size={17} />{state === "sending" ? "Enviando..." : "Enviar a revisión"}</button>
        </form>
      </div>
    </main>
  );
}
