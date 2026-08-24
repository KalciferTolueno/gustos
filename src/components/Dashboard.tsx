"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useDeferredValue, useState, type FormEvent } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  ExternalLink,
  Clock3,
  Heart,
  Layers3,
  ListFilter,
  Map,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Ticket,
  UserRound,
} from "lucide-react";
import { matchesEventSearch } from "@/lib/event-search";
import type { EventCard } from "@/lib/events";
import { EmailAuthForm } from "@/components/EmailAuthForm";
import { InterestPicker, type InterestTopic } from "@/components/InterestPicker";
import { SubmitEventForm } from "@/components/SubmitEventForm";
import { EventImageFallback } from "@/components/EventImageFallback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const EventMap = dynamic(() => import("./EventMap").then((module) => module.EventMap), {
  ssr: false,
  loading: () => <div className="map-loading">Preparando el mapa...</div>,
});

const chileTimeZone = "America/Santiago";
const dateFormatter = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: chileTimeZone });
const fullDateFormatter = new Intl.DateTimeFormat("es-CL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: chileTimeZone });
const dateOnlyFormatter = new Intl.DateTimeFormat("es-CL", { weekday: "short", day: "numeric", month: "short", timeZone: chileTimeZone });
const verifiedDateFormatter = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short", timeZone: chileTimeZone });
const eventStateLabels: Record<string, string> = { scheduled: "Programado", postponed: "Postergado", cancelled: "Cancelado", completed: "Finalizado" };
const pageSizes = [25, 50, 100] as const;
type DashboardProps = {
  events: EventCard[];
  demo: boolean;
  signedIn: boolean;
  userName?: string | null;
  interestTopics: InterestTopic[];
  initialInterests: number[];
  google: boolean;
  discord: boolean;
};

type EventDetailData = {
  event: EventCard;
  topicNames: string[];
  sources: Array<{
    id: number;
    name: string;
    url: string;
    isPrimary: boolean;
    lastCheckedAt: string | null;
    observations: Array<{ id: number; observedState: string; evidence: string | null; checkedAt: string; observedStartsAt: string | null; observedVenue: string | null }>;
  }>;
};

export function Dashboard({ events, demo, signedIn, userName, interestTopics, initialInterests, google, discord }: DashboardProps) {
  const router = useRouter();
  const [view, setView] = useState<"list" | "map">("list");
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("Todos");
  const [subtopic, setSubtopic] = useState("Todos");
  const [city, setCity] = useState("Todo Chile");
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [discoveredEventIds, setDiscoveredEventIds] = useState<string[]>([]);
  const [panel, setPanel] = useState<"account" | "interests" | "submit" | "event" | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventCard | null>(null);
  const [eventDetail, setEventDetail] = useState<EventDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof pageSizes)[number]>(25);
  const deferredQuery = useDeferredValue(query.trim());
  const topics = ["Todos", ...new Set(events.map((event) => event.categoryName))];
  const subtopics = ["Todos", ...new Set(events.filter((event) => topic === "Todos" || event.categoryName === topic).flatMap((event) => event.filterNames).filter((name) => name !== topic))];
  const cities = ["Todo Chile", ...new Set(events.map((event) => event.city).filter((value): value is string => Boolean(value)))];
  const filtered = events.filter((event) => (
    (topic === "Todos" || event.categoryName === topic)
    && (subtopic === "Todos" || event.filterNames.includes(subtopic))
    && (city === "Todo Chile" || event.city === city)
    && (matchesEventSearch(event, deferredQuery) || discoveredEventIds.includes(event.id))
  ));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const visibleEvents = filtered.slice(pageStart, pageStart + pageSize);

  function resetFilters() {
    setQuery("");
    setTopic("Todos");
    setSubtopic("Todos");
    setCity("Todo Chile");
    setSearchMessage("");
    setDiscoveredEventIds([]);
    setPage(1);
  }

  function scrollToEvents() {
    requestAnimationFrame(() => document.querySelector("#eventos")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function showList() {
    setView("list");
    scrollToEvents();
  }

  function showMap() {
    setView("map");
    scrollToEvents();
  }

  function changePage(nextPage: number) {
    setPage(Math.max(1, Math.min(totalPages, nextPage)));
    scrollToEvents();
  }

  async function searchWeb(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    document.querySelector("#eventos")?.scrollIntoView();
    const term = query.trim();
    if (term.length < 2) {
      setSearchMessage("Escribe al menos 2 caracteres.");
      return;
    }
    setSearching(true);
    const localEventIds = events.filter((item) => matchesEventSearch(item, term)).map((item) => item.id);
    setSearchMessage(localEventIds.length ? "Consultando el catálogo guardado..." : `Buscando eventos verificables sobre “${term}” en Chile...`);
    try {
      const response = await fetch("/api/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: term }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No pudimos completar la búsqueda.");
      if (result.skipped) {
        setSearchMessage(result.reason === "already-running" ? "El radar está ocupado con otra búsqueda. Intenta nuevamente en unos minutos." : "El radar alcanzó su límite de búsquedas por ahora.");
      } else if (result.published > 0) {
        setDiscoveredEventIds(result.eventIds ?? []);
        setSearchMessage(`Encontramos ${result.published} evento${result.published === 1 ? "" : "s"}. Actualizando resultados...`);
        startTransition(() => router.refresh());
      } else {
        setSearchMessage(`No encontramos eventos actuales o futuros verificables sobre “${term}” en Chile.`);
      }
    } catch (error) {
      setSearchMessage(error instanceof Error ? error.message : "No pudimos completar la búsqueda.");
    } finally {
      setSearching(false);
    }
  }

  async function openEvent(event: EventCard) {
    setSelectedEvent(event);
    setEventDetail(null);
    setPanel("event");
    if (demo) return;
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/events/${event.id}`);
      if (response.ok) setEventDetail(await response.json());
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <main id="main-content" className="discovery-shell min-h-screen overflow-hidden bg-[#0b0c0e] text-zinc-100" tabIndex={-1}>
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <div className="relative mx-auto max-w-[1440px] px-4 pb-28 pt-4 sm:px-6 lg:px-8">
        <header className="glass-panel sticky top-4 z-40 flex h-16 items-center justify-between rounded-2xl px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 text-lg font-medium tracking-tight text-zinc-100 no-underline">
            <span className="grid size-9 place-items-center rounded-xl border border-white/10 bg-white/8"><Layers3 className="size-4" /></span>
            Datito
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navegación principal">
            <Button variant="ghost" onClick={showList}><Compass /> Explorar</Button>
            <Button variant="ghost" onClick={showMap}><Map /> Mapa</Button>
            <Button variant="ghost" onClick={() => setPanel("interests")}><Heart /> Mis intereses</Button>
            <Button variant="ghost" onClick={() => setPanel("submit")}><Plus /> Enviar evento</Button>
          </nav>
          <Button variant="outline" className="max-w-[115px] overflow-hidden sm:max-w-none" onClick={() => setPanel(signedIn ? "interests" : "account")}><UserRound /> {userName ?? "Ingresar"}</Button>
        </header>

        <section className="mx-auto max-w-4xl pb-12 pt-16 text-center sm:pt-24">
          <Badge variant="outline" className="gap-2 px-3 py-1.5 text-zinc-300">
            <i className="size-1.5 rounded-full bg-emerald-400" />{events.length} panoramas en Chile
          </Badge>
          <h1 className="mt-5 text-balance text-4xl font-medium tracking-[-0.04em] sm:text-6xl">Tu próximo panorama está acá</h1>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-base leading-7 text-zinc-400 sm:text-lg">
            {userName ? `Hola, ${userName}. Descubre eventos según lo que realmente te gusta.` : "Explora gratis como invitado. Busca artistas, comunidades, juegos, anime y eventos futuros en Chile."}
          </p>
          <form onSubmit={searchWeb} className="glass-panel mt-8 grid gap-2 rounded-2xl p-2 text-left md:grid-cols-[1.5fr_1fr_auto] md:rounded-full">
            <label className="flex items-center gap-2 px-3">
              <Search className="size-4 shrink-0 text-zinc-500" aria-hidden="true" />
              <span className="sr-only">Buscar eventos</span>
              <Input value={query} onChange={(event) => { setQuery(event.target.value); setTopic("Todos"); setSubtopic("Todos"); setCity("Todo Chile"); setSearchMessage(""); setDiscoveredEventIds([]); setPage(1); }} placeholder="¿Qué quieres encontrar?" className="h-11 border-0 px-0 text-zinc-100 shadow-none" />
            </label>
            <div className="flex items-center gap-2 border-t border-white/8 px-3 md:border-l md:border-t-0">
              <MapPin className="size-4 shrink-0 text-zinc-500" aria-hidden="true" />
              <Select value={city} onValueChange={(value) => { setCity(value); setPage(1); }}><SelectTrigger aria-label="Filtrar por ciudad" className="h-11 border-0 px-0 text-zinc-300 shadow-none"><SelectValue /></SelectTrigger><SelectContent>{cities.map((item) => <SelectItem value={item} key={item}>{item}</SelectItem>)}</SelectContent></Select>
            </div>
            <Button type="submit" size="lg" disabled={searching} className="rounded-xl md:rounded-full"><Search data-icon="inline-start" /> {searching ? "Buscando…" : "Buscar"}</Button>
          </form>
          {searchMessage && <p className="mt-4 text-sm text-zinc-400" role="status" aria-live="polite">{searchMessage}</p>}
        </section>

        {demo && <Badge variant="outline" className="mx-auto mb-8 flex max-w-4xl whitespace-normal px-4 py-3 text-left leading-5 text-zinc-300"><Sparkles data-icon="inline-start" /><span>Datos de demostración. Conecta PostgreSQL y OpenAI para activar el radar real.</span></Badge>}

        <Tabs value={view} onValueChange={(value) => setView(value as "list" | "map")} id="eventos" className="scroll-mt-24 space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <div className="hide-scrollbar flex min-w-0 gap-2 overflow-x-auto pb-1">
                {topics.map((item) => (
                  <Button key={item} onClick={() => { setTopic(item); setSubtopic("Todos"); setPage(1); }} variant={topic === item ? "default" : "outline"} size="sm" className="min-h-11 shrink-0 rounded-full">
                    {topic === item && <Check />} {item}
                  </Button>
                ))}
              </div>
              {topic !== "Todos" && subtopics.length > 1 && <Select value={subtopic} onValueChange={(value) => { setSubtopic(value); setPage(1); }}><SelectTrigger aria-label={topic === "Música" ? "Filtrar por género musical" : "Filtrar por subcategoría"} className="w-full shrink-0 rounded-full sm:w-48"><SelectValue placeholder={topic === "Música" ? "Género musical" : "Subcategoría"} /></SelectTrigger><SelectContent>{subtopics.map((item) => <SelectItem value={item} key={item}>{item}</SelectItem>)}</SelectContent></Select>}
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-zinc-400" aria-live="polite">{filtered.length} resultado{filtered.length === 1 ? "" : "s"}{city !== "Todo Chile" ? ` en ${city}` : ""}</p>
              <TabsList aria-label="Vista"><TabsTrigger value="list" className="min-h-11"><ListFilter /> Lista</TabsTrigger><TabsTrigger value="map" className="min-h-11"><Map /> Mapa</TabsTrigger></TabsList>
            </div>
          </div>

          {!filtered.length ? <EmptyState query={deferredQuery} onReset={resetFilters} /> : <><TabsContent value="list"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{visibleEvents.map((event, index) => <EventTile key={event.id} event={event} index={index} onOpen={() => openEvent(event)} />)}</div></TabsContent><TabsContent value="map"><EventMap events={visibleEvents} /></TabsContent><EventPagination currentPage={currentPage} pageSize={pageSize} total={filtered.length} totalPages={totalPages} onPageChange={changePage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); scrollToEvents(); }} /></>}
        </Tabs>
      </div>

      <nav className="mobile-glass-nav" aria-label="Navegación móvil">
        <button type="button" onClick={showList}><Compass /><span>Explorar</span></button>
        <button type="button" onClick={showMap}><Map /><span>Mapa</span></button>
        <button onClick={() => setPanel("interests")}><Heart /><span>Intereses</span></button>
        <button onClick={() => setPanel("submit")}><Plus /><span>Enviar</span></button>
      </nav>

      <Dialog open={panel !== null} onOpenChange={(open) => { if (!open) setPanel(null); }}>
        <DialogContent className={panel === "account" ? "account-dialog max-w-xl gap-0 overflow-hidden p-0" : panel === "event" ? "max-w-3xl" : undefined}>
          {panel === "account" && <><div className="account-dialog-header"><span className="site-brand-mark"><Layers3 aria-hidden="true" /></span><div><DialogTitle>Tu radar, a tu manera</DialogTitle><DialogDescription>Guarda tus intereses y encuentra antes los panoramas que sí son para ti.</DialogDescription></div></div><EmailAuthForm google={google} discord={discord} /></>}
          {panel === "interests" && <><DialogHeader><DialogTitle>Mis intereses</DialogTitle><DialogDescription>Selecciona las señales que el radar debe priorizar para ti.</DialogDescription></DialogHeader>{signedIn ? <InterestPicker topics={interestTopics} initial={initialInterests} /> : <EmailAuthForm google={google} discord={discord} />}</>}
          {panel === "submit" && <><DialogHeader><DialogTitle>Comparte un evento</DialogTitle><DialogDescription>Incluye una fuente pública para que podamos verificarlo antes de publicar.</DialogDescription></DialogHeader>{signedIn ? <SubmitEventForm /> : <EmailAuthForm google={google} discord={discord} />}</>}
          {panel === "event" && selectedEvent && <EventDetail detail={eventDetail} fallback={selectedEvent} loading={detailLoading} />}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function EventPagination({ currentPage, pageSize, total, totalPages, onPageChange, onPageSizeChange }: { currentPage: number; pageSize: (typeof pageSizes)[number]; total: number; totalPages: number; onPageChange: (page: number) => void; onPageSizeChange: (size: (typeof pageSizes)[number]) => void }) {
  const firstResult = (currentPage - 1) * pageSize + 1;
  const lastResult = Math.min(currentPage * pageSize, total);
  const numberedPages = Array.from({ length: totalPages }, (_, index) => index + 1).filter((item) => item === 1 || item === totalPages || Math.abs(item - currentPage) <= 1);

  return (
    <nav aria-label="Paginación de eventos" className="mt-10 flex flex-col gap-5 px-1 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium tabular-nums text-zinc-300" aria-live="polite">Mostrando <b className="font-semibold text-zinc-100">{firstResult}–{lastResult}</b> <span className="font-normal text-zinc-500">de {total}</span></p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex items-center justify-between gap-3 text-sm font-medium text-zinc-300 sm:justify-start">
          Eventos por página
          <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value) as (typeof pageSizes)[number])}>
            <SelectTrigger aria-label="Eventos por página" className="h-10 w-20 rounded-xl bg-transparent tabular-nums"><SelectValue /></SelectTrigger>
            <SelectContent>{pageSizes.map((size) => <SelectItem value={String(size)} key={size}>{size}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex max-w-full items-center justify-start gap-1 overflow-x-auto pb-1 sm:justify-between" aria-label={`Página ${currentPage} de ${totalPages}`}>
          <Button variant="ghost" size="icon" className="size-10 rounded-xl text-zinc-400" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} aria-label="Página anterior"><ChevronLeft /></Button>
          {numberedPages.map((item, index) => <span key={item} className="contents">{index > 0 && item - numberedPages[index - 1] > 1 && <span className="grid size-8 place-items-center text-zinc-500" aria-hidden="true">…</span>}<Button variant={item === currentPage ? "default" : "ghost"} size="icon" className="size-10 rounded-xl text-sm tabular-nums" aria-current={item === currentPage ? "page" : undefined} onClick={() => onPageChange(item)} aria-label={`Página ${item}`}>{item}</Button></span>)}
          <Button variant="ghost" size="icon" className="size-10 rounded-xl text-zinc-400" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)} aria-label="Página siguiente"><ChevronRight /></Button>
        </div>
      </div>
    </nav>
  );
}

function EventTile({ event, index, onOpen }: { event: EventCard; index: number; onOpen: () => void }) {
  const date = new Date(event.startsAt);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const image = event.imageUrl && event.imageUrl !== failedImageUrl ? event.imageUrl : null;
  return (
    <Card className="event-tile gap-0 overflow-hidden rounded-3xl" style={{ "--tile-hue": `${190 + (index % 5) * 28}` } as React.CSSProperties}>
      <div className="event-visual relative h-64 overflow-hidden">
        {image && <Image src={image} alt="" fill unoptimized priority={index === 0} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw" className="z-0 object-cover" onError={() => setFailedImageUrl(image)} />}
        {!image && <EventImageFallback categoryName={event.categoryName} />}
        <Badge className="absolute left-3 top-3 z-10 bg-black/55 text-zinc-100 backdrop-blur-md">{dateFormatter.format(date)}</Badge>
        <Badge variant="outline" className="absolute right-3 top-3 z-10 bg-black/45 text-zinc-200 backdrop-blur-md">{event.eventState === "scheduled" ? `${event.confidence}% confianza` : eventStateLabels[event.eventState]}</Badge>
        <div className="absolute inset-x-0 bottom-0 z-10 p-4">
          <h2 className="line-clamp-2 text-lg font-semibold leading-tight tracking-tight text-white">{event.title}</h2>
          <p className="mt-2 line-clamp-3 text-xs leading-5 text-zinc-200">{event.description}</p>
        </div>
      </div>
      <CardContent className="p-4">
        <div className="mb-4"><Badge variant="secondary">{event.categoryName}</Badge></div>
        <div className="grid gap-2 border-t border-white/8 pt-4 text-xs text-zinc-400">
          <span className="flex items-center gap-2"><CalendarDays className="size-4" />{formatEventSchedule(event)}</span>
          <span className="flex items-center gap-2"><MapPin className="size-4" />{event.city ?? "Chile"}{event.venue ? ` · ${event.venue}` : ""}</span>
          {event.priceLabel && <span className="flex items-center gap-2"><Ticket className="size-4" />{event.priceLabel}</span>}
        </div>
      </CardContent>
      <CardFooter className="mt-auto flex-wrap justify-between gap-2 px-4 pb-4"><small className="min-w-0 flex-1 truncate text-[11px] text-zinc-500">{event.sourceName}</small><div className="flex items-center gap-2">{event.sourceUrl && <Button asChild variant="ghost" size="sm"><a href={event.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Ir a la publicación de ${event.title}`}>Ir al evento <ExternalLink /></a></Button>}<Button variant="outline" size="sm" onClick={onOpen}>Detalles</Button></div></CardFooter>
    </Card>
  );
}

function EventDetail({ detail, fallback, loading }: { detail: EventDetailData | null; fallback: EventCard; loading: boolean }) {
  const event = detail ? { ...fallback, ...detail.event, topicNames: detail.topicNames, filterNames: fallback.filterNames } : fallback;
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const image = event.imageUrl && event.imageUrl !== failedImageUrl ? event.imageUrl : null;
  return <div className="space-y-5"><div className="event-detail-visual relative h-56 overflow-hidden rounded-xl bg-zinc-900">{image && <Image src={image} alt="" fill unoptimized sizes="(max-width: 768px) 100vw, 768px" className="z-0 object-cover" onError={() => setFailedImageUrl(image)} />}{!image && <EventImageFallback categoryName={event.categoryName} />}<div className="absolute inset-x-0 bottom-0 z-10 p-5"><Badge variant="secondary">{eventStateLabels[event.eventState] ?? event.eventState}</Badge><DialogTitle className="mt-3 text-3xl">{event.title}</DialogTitle></div></div><p className="text-sm leading-7 text-zinc-300">{event.description}</p><div className="grid gap-3 rounded-xl border border-white/10 bg-white/4 p-4 text-sm text-zinc-300 sm:grid-cols-2"><span className="flex gap-2"><CalendarDays className="size-4 shrink-0" />{formatEventSchedule(event)}</span><span className="flex gap-2"><MapPin className="size-4 shrink-0" />{[event.venue, event.address, event.city, event.region].filter(Boolean).join(" · ")}</span>{event.priceLabel && <span className="flex gap-2"><Ticket className="size-4 shrink-0" />{event.priceLabel}</span>}<span className="flex gap-2"><Clock3 className="size-4 shrink-0" />Verificado {event.verifiedAt ? verifiedDateFormatter.format(new Date(event.verifiedAt)) : "pendiente"}</span></div>{event.statusReason && <div className="rounded-xl border border-amber-900 bg-amber-950 p-4 text-sm text-amber-50">{event.statusReason}</div>}<section><h3 className="font-medium">Fuentes y verificaciones</h3>{loading && <p className="mt-2 text-sm text-zinc-400">Cargando referencias...</p>}{!loading && !detail?.sources.length && <p className="mt-2 text-sm text-zinc-400">Solo hay una referencia disponible para este evento.</p>}<div className="mt-3 grid gap-3">{detail?.sources.map((source) => <div key={source.id} className="rounded-xl border border-white/10 p-4"><div className="flex items-center justify-between gap-3"><div><b className="text-sm">{source.name}</b>{source.isPrimary && <Badge variant="secondary" className="ml-2">Principal</Badge>}</div><Button asChild variant="outline" size="sm"><a href={source.url} target="_blank" rel="noreferrer">Abrir <ExternalLink /></a></Button></div><div className="mt-3 grid gap-2">{source.observations.slice(0, 3).map((observation) => <p key={observation.id} className="border-l border-white/10 pl-3 text-xs leading-5 text-zinc-400"><b className="text-zinc-300">{eventStateLabels[observation.observedState] ?? observation.observedState}</b> · {observation.evidence} · {dateOnlyFormatter.format(new Date(observation.checkedAt))}</p>)}</div></div>)}</div></section></div>;
}

function formatEventSchedule(event: Pick<EventCard, "startsAt" | "endsAt" | "timePrecision">) {
  const startsAt = new Date(event.startsAt);
  if (event.timePrecision !== "date") return fullDateFormatter.format(startsAt);
  const start = dateOnlyFormatter.format(startsAt);
  if (!event.endsAt) return `${start} · Horario por confirmar`;
  const end = dateOnlyFormatter.format(new Date(event.endsAt));
  return end === start ? `${start} · Horario por confirmar` : `${start} – ${end} · Horario por confirmar`;
}

function EmptyState({ query, onReset }: { query: string; onReset: () => void }) {
  return (
    <div className="glass-panel grid min-h-80 place-items-center rounded-3xl p-8 text-center">
      <div><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-white/8"><CalendarDays /></span><h2 className="mt-4 text-xl font-medium">No encontramos panoramas</h2><p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">{query ? `Todavía no hay eventos actuales o futuros registrados sobre “${query}” en Chile.` : "Prueba con otra categoría, ciudad o una búsqueda más amplia."}</p><Button className="mt-5" onClick={onReset}>Limpiar filtros</Button></div>
    </div>
  );
}
