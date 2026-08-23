"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  Compass,
  Heart,
  ListFilter,
  Map,
  MapPin,
  Search,
  Sparkles,
  Ticket,
  Plus,
} from "lucide-react";
import type { EventCard } from "@/lib/events";

const EventMap = dynamic(() => import("./EventMap").then((module) => module.EventMap), {
  ssr: false,
  loading: () => <div className="map-loading">Preparando el mapa...</div>,
});

const formatter = new Intl.DateTimeFormat("es-CL", { weekday: "short", day: "numeric", month: "short" });
const timeFormatter = new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit" });

export function Dashboard({ events, demo }: { events: EventCard[]; demo: boolean }) {
  const [view, setView] = useState<"timeline" | "map">("timeline");
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("Todos");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("es-CL"));
  const topics = ["Todos", ...new Set(events.flatMap((event) => event.topicNames))];
  const filtered = events.filter((event) => {
    const matchesTopic = topic === "Todos" || event.topicNames.includes(topic);
    const haystack = `${event.title} ${event.city} ${event.topicNames.join(" ")}`.toLocaleLowerCase("es-CL");
    return matchesTopic && (!deferredQuery || haystack.includes(deferredQuery));
  });

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a href="#" className="brand" aria-label="Gustos, inicio"><span>g</span> gustos</a>
        <nav className="desktop-nav" aria-label="Navegacion principal">
          <a className="active" href="#eventos"><Compass size={19} />Descubrir</a>
          <a href="#eventos"><CalendarDays size={19} />Mi calendario</a>
          <Link href="/gustos"><Heart size={19} />Mis gustos</Link>
          <a href="#mapa"><Map size={19} />Mapa</a>
          <Link href="/enviar"><Plus size={19} />Enviar evento</Link>
        </nav>
        <div className="agent-card">
          <Sparkles size={22} />
          <b>Radar activo</b>
          <p>La IA rastrea nuevos eventos y conserva siempre la fuente.</p>
          <span><i /> Proxima busqueda en 4 h</span>
        </div>
        <Link className="profile-link" href="/api/auth/signin"><CircleUserRound size={24} /><span><b>Entrar</b><small>Google o Discord</small></span></Link>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="mobile-brand"><span>g</span> gustos</div>
          <label className="search-box">
            <Search size={19} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Artista, anime, juego o ciudad..." />
          </label>
          <Link className="login-button" href="/api/auth/signin">Entrar</Link>
        </header>

        <div className="hero">
          <div>
            <span className="eyebrow"><i /> EN CHILE · ESTA SEMANA</span>
            <h1>Tu próximo<br /><em>panorama</em> está acá.</h1>
            <p>Eventos elegidos por lo que te mueve, no por lo que está de moda.</p>
          </div>
          <div className="hero-stat"><strong>{events.length.toString().padStart(2, "0")}</strong><span>eventos para ti</span><small>actualizados por el agente</small></div>
        </div>

        {demo && <div className="demo-banner"><Sparkles size={17} /><span>Estás viendo datos de demostración. Conecta PostgreSQL y OpenAI para activar eventos reales.</span></div>}

        <section id="gustos" className="filters-section">
          <div className="section-heading"><div><span>TUS SEÑALES</span><h2>Explora por gusto</h2></div><button><ListFilter size={17} /> Filtros</button></div>
          <div className="topic-row" role="list">
            {topics.map((item) => <button key={item} onClick={() => setTopic(item)} className={topic === item ? "selected" : ""}>{item}</button>)}
          </div>
        </section>

        <section id="eventos" className="events-section">
          <div className="section-heading event-heading">
            <div><span>PRÓXIMAMENTE</span><h2>{topic === "Todos" ? "Todo lo que te gusta" : topic}</h2></div>
            <div className="view-toggle" aria-label="Vista">
              <button onClick={() => setView("timeline")} className={view === "timeline" ? "selected" : ""}><CalendarDays size={17} /> Lista</button>
              <button id="mapa" onClick={() => setView("map")} className={view === "map" ? "selected" : ""}><Map size={17} /> Mapa</button>
            </div>
          </div>

          {view === "map" ? <EventMap events={filtered} /> : (
            <div className="timeline">
              {filtered.map((event, index) => {
                const date = new Date(event.startsAt);
                return (
                  <article className="event-card" key={event.id} style={{ "--delay": `${index * 45}ms` } as React.CSSProperties}>
                    <time><b>{date.getDate()}</b><span>{formatter.format(date).split(" ").at(-1)}</span><small>{timeFormatter.format(date)}</small></time>
                    <div className="timeline-pin"><i /></div>
                    <div className="event-body">
                      <div className="event-tags">{event.topicNames.map((name) => <span key={name}>{name}</span>)}{event.discoveredByAi && <span className="ai-tag"><Sparkles size={11} /> IA</span>}</div>
                      <h3>{event.title}</h3>
                      <p>{event.description}</p>
                      <div className="event-meta">
                        <span><MapPin size={15} />{event.city}{event.venue ? ` · ${event.venue}` : ""}</span>
                        {event.priceLabel && <span><Ticket size={15} />{event.priceLabel}</span>}
                      </div>
                      <div className="source-row">
                        <span>{event.sourceName} · confianza {event.confidence}%</span>
                        {event.sourceUrl ? <a href={event.sourceUrl} target="_blank" rel="noreferrer">Ver fuente <ChevronRight size={15} /></a> : <small>Evento ficticio</small>}
                      </div>
                    </div>
                  </article>
                );
              })}
              {!filtered.length && <div className="empty-state">No encontramos eventos con estos filtros.</div>}
            </div>
          )}
        </section>
      </section>

      <nav className="mobile-nav" aria-label="Navegacion movil">
        <a className="active" href="#eventos"><Compass /><span>Explorar</span></a>
        <a href="#eventos"><CalendarDays /><span>Agenda</span></a>
        <Link href="/gustos"><Heart /><span>Gustos</span></Link>
        <button onClick={() => setView("map")}><Map /><span>Mapa</span></button>
      </nav>
    </main>
  );
}
