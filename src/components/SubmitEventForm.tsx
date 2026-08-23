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

  if (state === "sent") return <div className="grid min-h-52 place-items-center text-center"><div><CheckCircle2 className="mx-auto size-12 text-emerald-400" /><h2 className="mt-4 text-xl font-medium">Evento recibido</h2><p className="mt-2 text-sm text-zinc-400">Lo revisaremos antes de publicarlo.</p></div></div>;
  return <form action={submit} className="inline-event-form"><label>Título<input name="title" required minLength={4} maxLength={160} /></label><label>Descripción<textarea name="description" required minLength={20} maxLength={2000} rows={4} /></label><div className="form-grid"><label>Fecha y hora<input name="startsAt" type="datetime-local" required /></label><label>Gusto o categoría<input name="topic" placeholder="Techno, Furry..." required /></label></div><div className="form-grid"><label>Ciudad<input name="city" required /></label><label>Región<input name="region" required /></label></div><div className="form-grid"><label>Lugar<input name="venue" /></label><label>Dirección exacta<input name="address" /></label></div><label>Enlace de la publicación<input name="sourceUrl" type="url" placeholder="https://..." required /></label>{state === "error" && <div className="form-error">{error}</div>}<Button disabled={state === "sending"}><Send />{state === "sending" ? "Enviando..." : "Enviar a revisión"}</Button></form>;
}
