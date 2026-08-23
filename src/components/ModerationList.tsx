"use client";

import { useState } from "react";

type PendingEvent = { id: string; title: string; city: string | null; startsAt: Date; sourceUrl: string; sourceName: string };

export function ModerationList({ initialEvents }: { initialEvents: PendingEvent[] }) {
  const [events, setEvents] = useState(initialEvents);
  async function moderate(id: string, action: "approve" | "reject") {
    const response = await fetch(`/api/events/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    if (response.ok) setEvents((items) => items.filter((item) => item.id !== id));
  }
  return <div className="moderation-list">{events.map((event) => <article key={event.id}><div><small>{event.sourceName}</small><h2>{event.title}</h2><p>{event.city} · {new Date(event.startsAt).toLocaleString("es-CL")}</p><a href={event.sourceUrl} target="_blank" rel="noreferrer">Abrir fuente</a></div><div><button onClick={() => moderate(event.id, "approve")}>Aprobar</button><button className="reject" onClick={() => moderate(event.id, "reject")}>Rechazar</button></div></article>)}{!events.length && <p className="empty-state">No hay eventos pendientes.</p>}</div>;
}
