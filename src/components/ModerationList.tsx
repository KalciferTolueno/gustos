"use client";

import { useState } from "react";
import { ExternalLink, LoaderCircle } from "lucide-react";
import { EventTile } from "@/components/EventTile";
import { Button } from "@/components/ui/button";
import type { PendingModerationEvent } from "@/lib/events";

type ModerationMessage = { tone: "success" | "error"; text: string } | null;

export function ModerationList({ initialEvents }: { initialEvents: PendingModerationEvent[] }) {
  const [events, setEvents] = useState(initialEvents);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<ModerationMessage>(null);
  async function moderate(id: string, action: "approve" | "reject") {
    setPendingAction(id);
    setMessage(null);
    try {
      const response = await fetch(`/api/events/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? "No pudimos actualizar el evento.");
      }
      setEvents((items) => items.filter((item) => item.id !== id));
      setMessage({ tone: "success", text: action === "approve" ? "Evento aprobado y publicado." : "Evento rechazado." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "No pudimos actualizar el evento. Inténtalo nuevamente." });
    } finally {
      setPendingAction(null);
    }
  }
  return <div>
    {message && <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "mb-4 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-100" : "mb-4 rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100"}>{message.text}</p>}
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
    {events.map((event, index) => {
      const isProcessing = pendingAction === event.id;
      return <article key={event.id} className="flex min-w-0 flex-col gap-3">
        <EventTile event={event} index={index} isAdmin={false} />
        <div className="flex flex-wrap items-center gap-2" aria-label={`Acciones de moderación para ${event.title}`}>
          {event.moderationSourceUrl && <Button asChild variant="ghost" size="sm"><a href={event.moderationSourceUrl} target="_blank" rel="noreferrer">Revisar fuente <ExternalLink /></a></Button>}
          <Button type="button" size="sm" disabled={isProcessing} onClick={() => moderate(event.id, "approve")}>{isProcessing && <LoaderCircle data-icon="inline-start" className="animate-spin" />}{isProcessing ? "Actualizando…" : "Aprobar"}</Button>
          <Button type="button" variant="outline" size="sm" disabled={isProcessing} onClick={() => moderate(event.id, "reject")}>Rechazar</Button>
        </div>
      </article>;
    })}
    </div>
    {!events.length && <p className="py-12 text-center text-sm text-zinc-400">No hay eventos pendientes.</p>}
  </div>;
}
