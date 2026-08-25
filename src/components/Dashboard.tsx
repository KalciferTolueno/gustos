"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { startTransition, useDeferredValue, useEffect, useState, type FormEvent } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  ExternalLink,
  Heart,
  LogOut,
  Map,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Ticket,
  UserRound,
} from "lucide-react";
import { matchesEventSearch } from "@/lib/event-search";
import { formatEventSchedule } from "@/lib/event-date-format";
import type { EventCard } from "@/lib/events";
import { EmailAuthForm } from "@/components/EmailAuthForm";
import { DatitoMark } from "@/components/DatitoMark";
import { InterestPicker, type InterestTopic } from "@/components/InterestPicker";
import { SubmitEventForm } from "@/components/SubmitEventForm";
import { EventImageFallback } from "@/components/EventImageFallback";
import { EventTile } from "@/components/EventTile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";

const EventMap = dynamic(() => import("./EventMap").then((module) => module.EventMap), {
  ssr: false,
  loading: () => <div className="map-loading" role="status">Preparando el mapa…</div>,
});

const chileTimeZone = "America/Santiago";
const dateOnlyFormatter = new Intl.DateTimeFormat("es-CL", { weekday: "short", day: "numeric", month: "short", timeZone: chileTimeZone });
const verifiedDateFormatter = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short", timeZone: chileTimeZone });
const eventStateLabels: Record<string, string> = { scheduled: "Programado", postponed: "Postergado", cancelled: "Cancelado", completed: "Finalizado" };
const pageSizes = [25, 50, 100] as const;
const myTastesFilter = "Mis gustos";

function interestKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CL").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function eventMatchesInterest(event: EventCard, interest: InterestTopic) {
  if (interest.type === "category") return event.categoryId === interest.id || interestKey(event.categoryName) === interest.slug;
  return [...event.topicNames, ...event.filterNames].some((name) => interestKey(name) === interest.slug);
}

function verificationEvidence(value: string | null) {
  if (!value) return null;
  return value === "Discovered and verified through web search" ? "Confirmado mediante búsqueda web" : value;
}

type DashboardProps = {
  events: EventCard[];
  demo: boolean;
  signedIn: boolean;
  isAdmin: boolean;
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

export function Dashboard({ events, demo, signedIn, isAdmin, userName, interestTopics, initialInterests, google, discord }: DashboardProps) {
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
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof pageSizes)[number]>(25);
  const deferredQuery = useDeferredValue(query.trim());
  const selectedInterestTopics = interestTopics.filter((interest) => initialInterests.includes(interest.id));
  const categoryFilters = [...(selectedInterestTopics.length ? [myTastesFilter] : []), "Todos", ...new Set(events.map((event) => event.categoryName))];
  const collapsedCategoryFilters = categoryFilters.slice(0, 4);
  if (!collapsedCategoryFilters.includes(topic) && categoryFilters.includes(topic)) collapsedCategoryFilters[collapsedCategoryFilters.length - 1] = topic;
  const visibleCategoryFilters = filtersExpanded ? categoryFilters : collapsedCategoryFilters;
  const hiddenCategoryFilterCount = Math.max(0, categoryFilters.length - collapsedCategoryFilters.length);
  const categorySubtopics = events.filter((event) => topic === "Todos" || event.categoryName === topic).flatMap((event) => event.filterNames).filter((name) => name !== topic);
  const subtopics = ["Todos", ...new Set(topic === myTastesFilter ? selectedInterestTopics.map((interest) => interest.name) : categorySubtopics)];
  const cities = ["Todo Chile", ...new Set(events.map((event) => event.city).filter((value): value is string => Boolean(value)))];
  const filtered = events.filter((event) => {
    const selectedInterest = subtopic === "Todos" ? null : selectedInterestTopics.find((interest) => interest.name === subtopic);
    const matchesTaste = selectedInterest ? eventMatchesInterest(event, selectedInterest) : selectedInterestTopics.some((interest) => eventMatchesInterest(event, interest));
    return (topic === "Todos" || topic === myTastesFilter ? topic !== myTastesFilter || matchesTaste : event.categoryName === topic)
      && (topic === myTastesFilter || subtopic === "Todos" || event.filterNames.includes(subtopic))
      && (city === "Todo Chile" || event.city === city)
      && (matchesEventSearch(event, deferredQuery) || discoveredEventIds.includes(event.id));
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const visibleEvents = filtered.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    const updateNavigation = () => setNavScrolled(window.scrollY > 48);
    updateNavigation();
    window.addEventListener("scroll", updateNavigation, { passive: true });
    return () => window.removeEventListener("scroll", updateNavigation);
  }, []);

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
    setSearchMessage(localEventIds.length ? "Consultando el catálogo guardado…" : `Buscando eventos verificables sobre “${term}” en Chile…`);
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
        setSearchMessage(`Encontramos ${result.published} evento${result.published === 1 ? "" : "s"}. Actualizando resultados…`);
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
    <main id="main-content" className="discovery-shell min-h-[100dvh] bg-[#0b0c0e] text-zinc-100" tabIndex={-1}>
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <div className="relative mx-auto max-w-[1440px] px-4 pb-28 pt-4 sm:px-6 lg:px-8">
        <header className={`glass-panel top-nav z-40 flex h-16 items-center justify-between rounded-2xl px-4 sm:px-6 ${navScrolled ? "top-nav-scrolled" : ""}`}>
          <Link href="/" className="flex items-center gap-2.5 text-lg font-medium tracking-tight text-zinc-100 no-underline">
            <DatitoMark className="size-9 shrink-0" />
            Datito
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navegación principal">
            <Button variant="ghost" aria-current={view === "list" ? "page" : undefined} onClick={showList}><Compass aria-hidden="true" /> Explorar</Button>
            <Button variant="ghost" aria-current={view === "map" ? "page" : undefined} onClick={showMap}><Map aria-hidden="true" /> Mapa</Button>
            <Button variant="ghost" onClick={() => setPanel("interests")}><Heart aria-hidden="true" /> Mis intereses</Button>
            <Button variant="ghost" onClick={() => setPanel("submit")}><Plus aria-hidden="true" /> Enviar evento</Button>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="max-w-[115px] overflow-hidden sm:max-w-none" onClick={() => setPanel(signedIn ? "interests" : "account")}><UserRound aria-hidden="true" /> {userName ?? "Ingresar"}</Button>
            {signedIn && <Button variant="outline" aria-label="Cerrar sesión" onClick={() => signOut({ callbackUrl: "/" })}><LogOut aria-hidden="true" /><span className="hidden sm:inline">Cerrar sesión</span></Button>}
          </div>
        </header>

        <section className="hero-stage pb-8 pt-10 sm:pb-10 sm:pt-12">
          <div className="min-w-0 max-w-5xl">
            <h1 className="max-w-4xl text-balance text-[clamp(2.75rem,6.2vw,5.8rem)] font-semibold leading-[.94] tracking-[-0.065em]">Encuentra un panorama que sí te guste</h1>
            <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-zinc-400 sm:text-lg">
              {userName ? `Hola, ${userName}. Tu radar prioriza eventos según tus intereses.` : "Busca artistas, comunidades y experiencias verificadas sin perderte entre carteleras genéricas."}
            </p>
            <form onSubmit={searchWeb} aria-busy={searching} className="search-console mt-7 grid gap-2 rounded-2xl p-2 text-left md:grid-cols-[1.45fr_1fr_auto]">
            <label className="flex items-center gap-2 px-3">
              <Search className="size-4 shrink-0 text-zinc-500" aria-hidden="true" />
              <span className="sr-only">Buscar eventos</span>
              <Input value={query} onChange={(event) => { setQuery(event.target.value); setTopic("Todos"); setSubtopic("Todos"); setCity("Todo Chile"); setSearchMessage(""); setDiscoveredEventIds([]); setPage(1); }} name="event-search" autoComplete="off" spellCheck={false} placeholder="Busca un artista, juego o comunidad…" className="h-11 border-0 px-0 text-zinc-100 shadow-none" />
            </label>
            <div className="flex items-center gap-2 border-t border-white/8 px-3 md:border-l md:border-t-0">
              <MapPin className="size-4 shrink-0 text-zinc-500" aria-hidden="true" />
              <Select value={city} onValueChange={(value) => { setCity(value); setPage(1); }}><SelectTrigger aria-label="Filtrar por ciudad" className="h-11 border-0 px-0 text-zinc-300 shadow-none"><SelectValue /></SelectTrigger><SelectContent>{cities.map((item) => <SelectItem value={item} key={item}>{item}</SelectItem>)}</SelectContent></Select>
            </div>
            <Button type="submit" size="lg" disabled={searching}>{searching ? <span className="search-progress" aria-hidden="true" /> : <Search aria-hidden="true" data-icon="inline-start" />} {searching ? "Buscando…" : "Buscar"}</Button>
            </form>
            {searchMessage && <p className="mt-4 text-sm text-zinc-400" role="status" aria-live="polite">{searchMessage}</p>}
          </div>
        </section>

        {demo && <Badge variant="outline" className="mx-auto mb-8 flex max-w-4xl whitespace-normal px-4 py-3 text-left leading-5 text-zinc-300"><Sparkles aria-hidden="true" data-icon="inline-start" /><span>Datos de demostración. Conecta PostgreSQL y OpenAI para activar el radar real.</span></Badge>}

        <Tabs value={view} onValueChange={(value) => setView(value as "list" | "map")} id="eventos" className="scroll-mt-24 space-y-6">
          <div className="filter-stage flex flex-col gap-5 rounded-2xl p-4 sm:p-5 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <div id="category-filters" className="flex min-w-0 flex-wrap gap-2">
                {visibleCategoryFilters.map((item) => (
                  <Button key={item} onClick={() => { setTopic(item); setSubtopic("Todos"); setPage(1); }} variant={topic === item ? "default" : "outline"} size="sm" className="min-h-11 shrink-0 rounded-full">
                    {topic === item ? <Check aria-hidden="true" data-icon="inline-start" /> : item === myTastesFilter ? <Heart aria-hidden="true" data-icon="inline-start" /> : null} {item}
                  </Button>
                ))}
                {hiddenCategoryFilterCount > 0 && <Button type="button" variant="outline" size="icon" className="size-11 shrink-0 rounded-full tabular-nums" aria-controls="category-filters" aria-expanded={filtersExpanded} aria-label={filtersExpanded ? "Mostrar menos filtros" : `Mostrar ${hiddenCategoryFilterCount} filtros más`} title={filtersExpanded ? "Mostrar menos" : "Mostrar más filtros"} onClick={() => setFiltersExpanded((expanded) => !expanded)}>{filtersExpanded ? "−" : `+${hiddenCategoryFilterCount}`}</Button>}
              </div>
              {topic !== "Todos" && subtopics.length > 1 && <Select value={subtopic} onValueChange={(value) => { setSubtopic(value); setPage(1); }}><SelectTrigger aria-label={topic === myTastesFilter ? "Filtrar por mis gustos" : topic === "Música" ? "Filtrar por género musical" : "Filtrar por subcategoría"} className="w-full shrink-0 rounded-full sm:w-48"><SelectValue placeholder={topic === myTastesFilter ? "Mis gustos" : topic === "Música" ? "Género musical" : "Subcategoría"} /></SelectTrigger><SelectContent>{subtopics.map((item) => <SelectItem value={item} key={item}>{item === "Todos" && topic === myTastesFilter ? "Todos mis gustos" : item}</SelectItem>)}</SelectContent></Select>}
            </div>
            <div className="flex min-h-11 shrink-0 items-center justify-end gap-3 md:ml-auto">
              <p className="text-sm tabular-nums text-zinc-400" aria-live="polite">{filtered.length} resultado{filtered.length === 1 ? "" : "s"}{city !== "Todo Chile" ? ` en ${city}` : ""}</p>
            </div>
          </div>

          {!filtered.length ? <EmptyState query={deferredQuery} onReset={resetFilters} /> : <><TabsContent value="list" className="view-panel"><div key={`${topic}-${subtopic}-${city}-${currentPage}-${discoveredEventIds.join("-")}`} className="events-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{visibleEvents.map((event, index) => <EventTile key={event.id} event={event} index={index} isAdmin={isAdmin} onOpen={() => openEvent(event)} />)}</div></TabsContent><TabsContent value="map" className="view-panel"><EventMap events={visibleEvents} /></TabsContent><EventPagination currentPage={currentPage} pageSize={pageSize} total={filtered.length} totalPages={totalPages} onPageChange={changePage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); scrollToEvents(); }} /></>}
        </Tabs>
      </div>

      <nav className="mobile-glass-nav" aria-label="Navegación móvil">
        <button type="button" aria-current={view === "list" ? "page" : undefined} onClick={showList}><Compass aria-hidden="true" /><span>Explorar</span></button>
        <button type="button" aria-current={view === "map" ? "page" : undefined} onClick={showMap}><Map aria-hidden="true" /><span>Mapa</span></button>
        <button type="button" onClick={() => setPanel("interests")}><Heart aria-hidden="true" /><span>Intereses</span></button>
        <button type="button" onClick={() => setPanel("submit")}><Plus aria-hidden="true" /><span>Enviar</span></button>
      </nav>

      <Dialog open={panel !== null} onOpenChange={(open) => { if (!open) setPanel(null); }}>
        <DialogContent className={panel === "account" ? "account-dialog max-w-xl gap-0 overflow-hidden p-0" : panel === "interests" ? "max-w-4xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-6 sm:p-8" : panel === "event" ? "max-w-4xl gap-0 overflow-hidden p-0" : undefined}>
          {panel === "account" && <><div className="account-dialog-header"><DatitoMark className="size-10 shrink-0" /><div><DialogTitle>Tu radar, a tu manera</DialogTitle><DialogDescription>Guarda tus intereses y encuentra antes los panoramas que sí son para ti.</DialogDescription></div></div><EmailAuthForm google={google} discord={discord} /></>}
          {panel === "interests" && <><DialogHeader className="mb-5"><DialogTitle className="text-2xl tracking-tight sm:text-3xl">Mis intereses</DialogTitle><DialogDescription className="max-w-2xl">Selecciona las señales que el radar debe priorizar para ti.</DialogDescription></DialogHeader>{signedIn ? <div className="-mx-6 min-h-0 overflow-y-auto px-6 sm:-mx-8 sm:px-8"><InterestPicker topics={interestTopics} initial={initialInterests} /></div> : <EmailAuthForm google={google} discord={discord} />}</>}
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
      <p className="text-sm font-medium tabular-nums text-zinc-300" aria-live="polite">Mostrando <b className="font-semibold text-zinc-100">{firstResult}-{lastResult}</b> <span className="font-normal text-zinc-500">de {total}</span></p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex items-center justify-between gap-3 text-sm font-medium text-zinc-300 sm:justify-start">
          Eventos por página
          <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value) as (typeof pageSizes)[number])}>
            <SelectTrigger aria-label="Eventos por página" className="h-10 w-20 rounded-xl bg-transparent tabular-nums"><SelectValue /></SelectTrigger>
            <SelectContent>{pageSizes.map((size) => <SelectItem value={String(size)} key={size}>{size}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex max-w-full items-center justify-start gap-1 overflow-x-auto pb-1 sm:justify-between" aria-label={`Página ${currentPage} de ${totalPages}`}>
          <Button variant="ghost" size="icon" className="size-11 rounded-xl text-zinc-400" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} aria-label="Página anterior"><ChevronLeft aria-hidden="true" /></Button>
          {numberedPages.map((item, index) => <span key={item} className="contents">{index > 0 && item - numberedPages[index - 1] > 1 && <span className="grid size-8 place-items-center text-zinc-500" aria-hidden="true">…</span>}<Button variant={item === currentPage ? "default" : "ghost"} size="icon" className="size-10 rounded-xl text-sm tabular-nums" aria-current={item === currentPage ? "page" : undefined} onClick={() => onPageChange(item)} aria-label={`Página ${item}`}>{item}</Button></span>)}
          <Button variant="ghost" size="icon" className="size-11 rounded-xl text-zinc-400" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)} aria-label="Página siguiente"><ChevronRight aria-hidden="true" /></Button>
        </div>
      </div>
    </nav>
  );
}

function EventDetail({ detail, fallback, loading }: { detail: EventDetailData | null; fallback: EventCard; loading: boolean }) {
  const event = detail ? { ...fallback, ...detail.event, topicNames: detail.topicNames, filterNames: fallback.filterNames } : fallback;
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const image = event.imageUrl && event.imageUrl !== failedImageUrl ? event.imageUrl : null;
  const location = event.modality === "online" ? "Evento online" : [event.venue, event.address, event.city, event.region].filter(Boolean).join(", ") || "Ubicación por confirmar";
  return (
    <div className="event-detail-scroll max-h-[90vh] overflow-y-auto">
      <div className="grid md:grid-cols-[minmax(18rem,.9fr)_minmax(0,1.1fr)]">
        <div className="event-detail-visual relative min-h-64 overflow-hidden bg-zinc-900 md:min-h-[31rem]">
        {image && <Image src={image} alt="" fill unoptimized loading="eager" sizes="(max-width: 768px) 100vw, 42vw" className="z-0 object-cover" onError={() => setFailedImageUrl(image)} />}
        {!image && <EventImageFallback categoryName={event.categoryName} />}
        </div>
        <div className="flex flex-col p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{event.categoryName}</Badge>
            <Badge variant="outline">{eventStateLabels[event.eventState] ?? event.eventState}</Badge>
          {event.discoveredByAi && <Badge variant="secondary"><Sparkles aria-hidden="true" /> Descubierto por Datito</Badge>}
          </div>
          <DialogTitle className="mt-5 text-balance text-3xl font-medium tracking-[-0.03em] sm:text-4xl">{event.title}</DialogTitle>
          <p className="mt-4 text-pretty text-sm leading-7 text-muted-foreground">{event.description}</p>
          {event.topicNames.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{event.topicNames.slice(0, 4).map((topicName) => <Badge key={topicName} variant="secondary">{topicName}</Badge>)}</div>}
          <dl className="mt-7 divide-y divide-border border-y border-border">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 py-4"><span className="grid size-9 place-items-center rounded-lg bg-secondary text-secondary-foreground"><CalendarDays aria-hidden="true" className="size-4" /></span><div><dt className="text-xs text-muted-foreground">Fecha y hora</dt><dd className="mt-1 text-sm font-medium leading-6">{formatEventSchedule(event)}</dd></div></div>
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 py-4"><span className="grid size-9 place-items-center rounded-lg bg-secondary text-secondary-foreground"><MapPin aria-hidden="true" className="size-4" /></span><div><dt className="text-xs text-muted-foreground">Ubicación</dt><dd className="mt-1 text-sm font-medium leading-6">{location}</dd></div></div>
            <div className="grid grid-cols-2 gap-4 py-4"><div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground"><Ticket aria-hidden="true" className="size-4" /></span><div><dt className="text-xs text-muted-foreground">Entrada</dt><dd className="mt-1 text-sm font-medium">{event.priceLabel ?? "Por confirmar"}</dd></div></div><div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground"><ShieldCheck aria-hidden="true" className="size-4" /></span><div><dt className="text-xs text-muted-foreground">Verificación</dt><dd className="mt-1 text-sm font-medium">{event.verifiedAt ? verifiedDateFormatter.format(new Date(event.verifiedAt)) : "Pendiente"}</dd></div></div></div>
          </dl>
          {event.statusReason && <div className="mt-5 rounded-xl border border-amber-900 bg-amber-950 p-4 text-sm text-amber-50">{event.statusReason}</div>}
        </div>
      </div>
      <section className="border-t border-border bg-background/30 p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-lg font-medium">Fuentes y verificaciones</h3><p className="mt-1 text-sm text-muted-foreground">Referencias utilizadas para confirmar la información del evento.</p></div>{detail?.sources.length ? <Badge variant="outline">{detail.sources.length} fuente{detail.sources.length === 1 ? "" : "s"}</Badge> : null}</div>
        {loading && <div className="mt-5 grid gap-3" role="status" aria-label="Cargando referencias"><span className="skeleton-line w-2/3" /><span className="skeleton-line w-1/2" /></div>}
        {!loading && !detail?.sources.length && <p className="mt-5 text-sm text-muted-foreground">Solo hay una referencia disponible para este evento.</p>}
        {detail?.sources.length ? <div className="mt-5 divide-y divide-border border-y border-border">
          {detail.sources.map((source) => (
            <article key={source.id} className="py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><b className="truncate text-sm">{source.name}</b>{source.isPrimary && <Badge variant="secondary">Principal</Badge>}</div>{source.observations[0] && <p className="mt-2 text-xs leading-5 text-muted-foreground"><b className="font-medium text-foreground">{eventStateLabels[source.observations[0].observedState] ?? source.observations[0].observedState}</b>{verificationEvidence(source.observations[0].evidence) ? `, ${verificationEvidence(source.observations[0].evidence)}` : ""}, {dateOnlyFormatter.format(new Date(source.observations[0].checkedAt))}{source.observations.length > 1 ? `, ${source.observations.length} verificaciones` : ""}</p>}</div>
                <Button asChild variant="outline" size="sm" className="shrink-0"><a href={source.url} target="_blank" rel="noreferrer">Ver fuente <ExternalLink aria-hidden="true" data-icon="inline-end" /></a></Button>
              </div>
            </article>
          ))}
        </div> : null}
      </section>
    </div>
  );
}

function EmptyState({ query, onReset }: { query: string; onReset: () => void }) {
  return (
    <div className="glass-panel grid min-h-80 place-items-center rounded-3xl p-8 text-center">
      <div><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-white/8"><CalendarDays aria-hidden="true" /></span><h2 className="mt-4 text-xl font-medium">No encontramos panoramas</h2><p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">{query ? `Todavía no hay eventos actuales o futuros registrados sobre “${query}” en Chile.` : "Prueba con otra categoría, ciudad o una búsqueda más amplia."}</p><Button className="mt-5" onClick={onReset}>Limpiar filtros</Button></div>
    </div>
  );
}
