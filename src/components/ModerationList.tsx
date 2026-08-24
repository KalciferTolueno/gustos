"use client";

import { useState } from "react";

const dateFormatter = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Santiago" });

type PendingEvent = { id: string; title: string; city: string | null; startsAt: Date; sourceUrl: string; sourceName: string };

export function ModerationList({ initialEvents }: { initialEvents: PendingEvent[] }) {
  const [events, setEvents] = useState(initialEvents);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  async function moderate(id: string, action: "approve" | "reject") {
    setPendingAction(id);
    setMessage("");
    try {
      const response = await fetch(`/api/events/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      if (!response.ok) throw new Error();
      setEvents((items) => items.filter((item) => item.id !== id));
      setMessage(action === "approve" ? "Evento aprobado." : "Evento rechazado.");
    } catch {
      setMessage("No pudimos actualizar el evento. Inténtalo nuevamente.");
    } finally {
      setPendingAction(null);
    }
  }
  return <div className="moderation-list">
    <p className="sr-only" role="status" aria-live="polite">{message}</p>
    {events.map((event) => {
      const isProcessing = pendingAction === event.id;
      return <article key={event.id}><div><small>{event.sourceName}</small><h2>{event.title}</h2><p>{event.city} · {dateFormatter.format(new Date(event.startsAt))}</p><a href={event.sourceUrl} target="_blank" rel="noreferrer">Abrir Fuente<span className="sr-only">: {event.title}</span></a></div><div><button type="button" disabled={isProcessing} onClick={() => moderate(event.id, "approve")}>{isProcessing ? "Actualizando…" : "Aprobar"}</button><button type="button" disabled={isProcessing} className="reject" onClick={() => moderate(event.id, "reject")}>Rechazar</button></div></article>;
    })}
    {!events.length && <p className="empty-state">No hay eventos pendientes.</p>}
  </div>;
}
