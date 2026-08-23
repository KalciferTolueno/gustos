"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useDeferredValue, useState, type FormEvent } from "react";
import {
  CalendarDays,
  Check,
  Compass,
  ExternalLink,
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

const dateFormatter = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" });
const fullDateFormatter = new Intl.DateTimeFormat("es-CL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const referenceImages = [
  "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80",
];

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

export function Dashboard({ events, demo, signedIn, userName, interestTopics, initialInterests, google, discord }: DashboardProps) {
  const router = useRouter();
  const [view, setView] = useState<"list" | "map">("list");
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("Todos");
  const [city, setCity] = useState("Todo Chile");
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [panel, setPanel] = useState<"account" | "interests" | "submit" | null>(null);
  const deferredQuery = useDeferredValue(query.trim());
  const topics = ["Todos", ...new Set(events.flatMap((event) => event.topicNames))];
  const cities = ["Todo Chile", ...new Set(events.map((event) => event.city).filter((value): value is string => Boolean(value)))];
  const filtered = events.filter((event) => (
    (topic === "Todos" || event.topicNames.includes(topic))
    && (city === "Todo Chile" || event.city === city)
    && matchesEventSearch(event, deferredQuery)
  ));

  function resetFilters() {
    setQuery("");
    setTopic("Todos");
    setCity("Todo Chile");
    setSearchMessage("");
  }

  async function searchWeb(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    document.querySelector("#eventos")?.scrollIntoView();
    const term = query.trim();
    if (term.length < 2) {
      setSearchMessage("Escribe al menos 2 caracteres.");
      return;
    }
    if (events.some((item) => matchesEventSearch(item, term))) {
      setSearchMessage("Mostrando los eventos que ya encontramos.");
      return;
    }

    setSearching(true);
    setSearchMessage(`Buscando eventos verificables sobre “${term}” en Chile...`);
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
        setSearchMessage(`Encontramos ${result.published} evento${result.published === 1 ? "" : "s"}. Actualizando resultados...`);
        startTransition(() => router.refresh());
      } else {
        setSearchMessage(`No encontramos eventos futuros verificables sobre “${term}” en Chile.`);
      }
    } catch (error) {
      setSearchMessage(error instanceof Error ? error.message : "No pudimos completar la búsqueda.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <main className="discovery-shell min-h-screen overflow-hidden bg-[#0b0c0e] text-zinc-100">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <div className="relative mx-auto max-w-[1440px] px-4 pb-28 pt-4 sm:px-6 lg:px-8">
        <header className="glass-panel sticky top-4 z-40 flex h-16 items-center justify-between rounded-2xl px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 text-lg font-medium tracking-tight text-zinc-100 no-underline">
            <span className="grid size-9 place-items-center rounded-xl border border-white/10 bg-white/8"><Layers3 className="size-4" /></span>
            Gustos
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navegación principal">
            <Button asChild variant="ghost"><a href="#eventos"><Compass /> Explorar</a></Button>
            <Button variant="ghost" onClick={() => { setView("map"); document.querySelector("#eventos")?.scrollIntoView(); }}><Map /> Mapa</Button>
            <Button variant="ghost" onClick={() => setPanel("interests")}><Heart /> Mis gustos</Button>
            <Button variant="ghost" onClick={() => setPanel("submit")}><Plus /> Enviar evento</Button>
          </nav>
          <Button variant="outline" className="max-w-[115px] overflow-hidden sm:max-w-none" onClick={() => setPanel(signedIn ? "interests" : "account")}><UserRound /> {userName ?? "Ingresar"}</Button>
        </header>

        <section className="mx-auto max-w-4xl pb-12 pt-16 text-center sm:pt-24">
          <Badge variant="outline" className="gap-2 px-3 py-1.5 text-zinc-300">
            <i className="size-1.5 rounded-full bg-emerald-400" />{events.length} panoramas en Chile
          </Badge>
          <h1 className="mt-5 text-balance text-4xl font-medium tracking-[-0.045em] sm:text-6xl">Tu próximo panorama está acá</h1>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-base leading-7 text-zinc-400 sm:text-lg">
            {userName ? `Hola, ${userName}. Descubre eventos según lo que realmente te gusta.` : "Explora gratis como invitado. Busca artistas, comunidades, juegos, anime y eventos futuros en Chile."}
          </p>
          <form onSubmit={searchWeb} className="glass-panel mt-8 grid gap-2 rounded-2xl p-2 text-left md:grid-cols-[1.5fr_1fr_auto] md:rounded-full">
            <label className="flex items-center gap-2 px-3">
              <Search className="size-4 shrink-0 text-zinc-500" />
              <Input value={query} onChange={(event) => { setQuery(event.target.value); setTopic("Todos"); setCity("Todo Chile"); setSearchMessage(""); }} placeholder="¿Qué quieres encontrar?" className="h-11 border-0 px-0 text-zinc-100 shadow-none focus-visible:ring-0" />
            </label>
            <div className="flex items-center gap-2 border-t border-white/8 px-3 md:border-l md:border-t-0">
              <MapPin className="size-4 shrink-0 text-zinc-500" />
              <Select value={city} onValueChange={setCity}><SelectTrigger className="h-11 border-0 px-0 text-zinc-300 shadow-none focus:ring-0"><SelectValue /></SelectTrigger><SelectContent>{cities.map((item) => <SelectItem value={item} key={item}>{item}</SelectItem>)}</SelectContent></Select>
            </div>
            <Button type="submit" size="lg" disabled={searching} className="rounded-xl md:rounded-full"><Search /> {searching ? "Buscando..." : "Buscar"}</Button>
          </form>
          {searchMessage && <p className="mt-4 text-sm text-zinc-400" role="status" aria-live="polite">{searchMessage}</p>}
        </section>

        {demo && <Badge variant="outline" className="mx-auto mb-8 flex max-w-4xl gap-2 px-4 py-3 text-zinc-300"><Sparkles /><span>Datos de demostración. Conecta PostgreSQL y OpenAI para activar el radar real.</span></Badge>}

        <Tabs value={view} onValueChange={(value) => setView(value as "list" | "map")} id="eventos" className="scroll-mt-24 space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
              {topics.map((item) => (
                <Button key={item} onClick={() => setTopic(item)} variant={topic === item ? "default" : "outline"} size="sm" className="shrink-0 rounded-full">
                  {topic === item && <Check />} {item}
                </Button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-zinc-400" aria-live="polite">{filtered.length} resultado{filtered.length === 1 ? "" : "s"}{city !== "Todo Chile" ? ` en ${city}` : ""}</p>
              <TabsList aria-label="Vista"><TabsTrigger value="list"><ListFilter /> Lista</TabsTrigger><TabsTrigger value="map"><Map /> Mapa</TabsTrigger></TabsList>
            </div>
          </div>

          {!filtered.length ? <EmptyState query={deferredQuery} onReset={resetFilters} /> : <><TabsContent value="list"><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{filtered.map((event, index) => <EventTile key={event.id} event={event} index={index} />)}</div></TabsContent><TabsContent value="map"><EventMap events={filtered} /></TabsContent></>}
        </Tabs>
      </div>

      <nav className="mobile-glass-nav" aria-label="Navegación móvil">
        <a href="#eventos"><Compass /><span>Explorar</span></a>
        <button onClick={() => setView("map")}><Map /><span>Mapa</span></button>
        <button onClick={() => setPanel("interests")}><Heart /><span>Gustos</span></button>
        <button onClick={() => setPanel("submit")}><Plus /><span>Enviar</span></button>
      </nav>

      <Dialog open={panel !== null} onOpenChange={(open) => { if (!open) setPanel(null); }}>
        <DialogContent className={panel === "account" ? "max-w-lg" : undefined}>
          {panel === "account" && <><DialogHeader><DialogTitle>Bienvenido a Gustos</DialogTitle><DialogDescription>Ingresa o crea una cuenta sin salir de la aplicación.</DialogDescription></DialogHeader><EmailAuthForm google={google} discord={discord} /></>}
          {panel === "interests" && <><DialogHeader><DialogTitle>Mis gustos</DialogTitle><DialogDescription>Selecciona las señales que el radar debe priorizar para ti.</DialogDescription></DialogHeader>{signedIn ? <InterestPicker topics={interestTopics} initial={initialInterests} /> : <EmailAuthForm google={google} discord={discord} />}</>}
          {panel === "submit" && <><DialogHeader><DialogTitle>Comparte un evento</DialogTitle><DialogDescription>Incluye una fuente pública para que podamos verificarlo antes de publicar.</DialogDescription></DialogHeader>{signedIn ? <SubmitEventForm /> : <EmailAuthForm google={google} discord={discord} />}</>}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function EventTile({ event, index }: { event: EventCard; index: number }) {
  const date = new Date(event.startsAt);
  const topic = event.topicNames[0] ?? "Panorama";
  const image = event.imageUrl ?? referenceImages[index % referenceImages.length];
  return (
    <Card className="event-tile gap-0 overflow-hidden rounded-3xl" style={{ "--tile-hue": `${190 + (index % 5) * 28}` } as React.CSSProperties}>
      <div className="event-visual relative grid h-44 place-items-center overflow-hidden" style={{ backgroundImage: `url("${image}")` }}>
        <Badge className="absolute left-3 top-3 bg-black/55 text-zinc-100 backdrop-blur-md">{dateFormatter.format(date)}</Badge>
        <Badge variant="outline" className="absolute right-3 top-3 bg-black/45 text-zinc-200 backdrop-blur-md">{event.confidence}% confianza</Badge>
        <strong className="relative z-10 max-w-[80%] text-center text-xl font-medium tracking-tight">{topic}</strong>
      </div>
      <CardContent className="p-5">
        <div className="mb-3 flex flex-wrap gap-2">{event.topicNames.slice(0, 3).map((name) => <Badge variant="secondary" key={name}>{name}</Badge>)}{event.discoveredByAi && <Badge variant="secondary"><Sparkles /> IA</Badge>}</div>
        <h2 className="text-xl font-medium tracking-tight">{event.title}</h2>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-400">{event.description}</p>
        <div className="mt-5 grid gap-2 border-t border-white/8 pt-4 text-sm text-zinc-400">
          <span className="flex items-center gap-2"><CalendarDays className="size-4" />{fullDateFormatter.format(date)}</span>
          <span className="flex items-center gap-2"><MapPin className="size-4" />{event.city ?? "Chile"}{event.venue ? ` · ${event.venue}` : ""}</span>
          {event.priceLabel && <span className="flex items-center gap-2"><Ticket className="size-4" />{event.priceLabel}</span>}
        </div>
      </CardContent>
      <CardFooter className="justify-between gap-3 px-5 pb-5"><small className="truncate text-xs text-zinc-500">{event.sourceName}</small>{event.sourceUrl ? <Button asChild variant="outline" size="sm"><a href={event.sourceUrl} target="_blank" rel="noreferrer">Ver fuente <ExternalLink /></a></Button> : <span className="text-xs text-zinc-500">Evento ficticio</span>}</CardFooter>
    </Card>
  );
}

function EmptyState({ query, onReset }: { query: string; onReset: () => void }) {
  return (
    <div className="glass-panel grid min-h-80 place-items-center rounded-3xl p-8 text-center">
      <div><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-white/8"><CalendarDays /></span><h2 className="mt-4 text-xl font-medium">No encontramos panoramas</h2><p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">{query ? `Todavía no hay eventos actuales o futuros registrados sobre “${query}” en Chile.` : "Prueba con otra categoría, ciudad o una búsqueda más amplia."}</p><Button className="mt-5" onClick={onReset}>Limpiar filtros</Button></div>
    </div>
  );
}
