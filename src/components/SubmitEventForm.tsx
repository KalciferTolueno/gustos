"use client";

import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  if (state === "sent") return <div className="submission-success grid min-h-52 place-items-center text-center" role="status" aria-live="polite"><div><CheckCircle2 className="mx-auto size-12 text-emerald-400" aria-hidden="true" /><h2 className="mt-4 text-xl font-medium">Evento Recibido</h2><p className="mt-2 text-sm text-zinc-400">Lo revisaremos antes de publicarlo.</p></div></div>;
  return <form action={submit} className="inline-event-form" aria-describedby="event-form-help">
    <p id="event-form-help" className="text-sm leading-6 text-zinc-400">Los campos marcados como obligatorios nos ayudan a verificar el evento antes de publicarlo.</p>
    <label>Título<input name="title" autoComplete="off" required minLength={4} maxLength={160} /></label>
    <label>Descripción<textarea name="description" required minLength={20} maxLength={2000} rows={4} /></label>
    <div className="form-grid"><label>Fecha y hora<input name="startsAt" type="datetime-local" required /></label><label>Gusto o categoría<input name="topic" autoComplete="off" placeholder="Ej.: Techno o Furry" required /></label></div>
    <div className="form-grid"><label>Ciudad<input name="city" autoComplete="address-level2" required /></label><label>Región<input name="region" autoComplete="address-level1" required /></label></div>
    <div className="form-grid"><label>Lugar<input name="venue" autoComplete="organization" /></label><label>Dirección exacta<input name="address" autoComplete="street-address" /></label></div>
    <label>Enlace de la publicación<input name="sourceUrl" type="url" inputMode="url" autoComplete="url" placeholder="https://ejemplo.cl/evento" required /></label>
    {state === "error" && <div className="form-error" role="alert">{error}</div>}
    <Button type="submit" disabled={state === "sending"}><Send data-icon="inline-start" />{state === "sending" ? "Enviando…" : "Enviar a Revisión"}</Button>
  </form>;
}
