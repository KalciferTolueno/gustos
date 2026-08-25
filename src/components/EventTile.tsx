"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import Image from "next/image";
import { CalendarDays, ExternalLink, MapPin, Ticket } from "lucide-react";
import { eventDateRangeLabels, formatEventSchedule } from "@/lib/event-date-format";
import type { EventCard } from "@/lib/events";
import { EventImageFallback } from "@/components/EventImageFallback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

const eventStateLabels: Record<string, string> = { scheduled: "Programado", postponed: "Postergado", cancelled: "Cancelado", completed: "Finalizado" };

export function EventTile({ event, index, isAdmin, onOpen }: { event: EventCard; index: number; isAdmin: boolean; onOpen?: () => void }) {
  const dateRange = eventDateRangeLabels(event);
  const endDateTime = event.endsAt ? new Date(event.endsAt).toISOString() : null;
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const image = event.imageUrl && event.imageUrl !== failedImageUrl ? event.imageUrl : null;
  return (
    <Card className="event-tile gap-0 overflow-hidden rounded-3xl" style={{ "--tile-hue": `${190 + (index % 5) * 28}`, "--entry-delay": `${Math.min(index, 4) * 45}ms` } as CSSProperties}>
      <div className="event-visual relative h-64 overflow-hidden">
        {image && <Image src={image} alt="" fill unoptimized priority={index === 0} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw" className="z-0 object-cover" onError={() => setFailedImageUrl(image)} />}
        {!image && <EventImageFallback categoryName={event.categoryName} />}
        <Badge className="absolute left-3 top-3 z-10 flex-col items-start gap-0.5 bg-black/55 py-1.5 leading-tight text-zinc-100 backdrop-blur-md">
          <time dateTime={new Date(event.startsAt).toISOString()}>{dateRange.end ? `Desde ${dateRange.start}` : dateRange.start}</time>
          {dateRange.end && endDateTime && <time dateTime={endDateTime}>Hasta {dateRange.end}</time>}
        </Badge>
        <Badge variant="outline" className="absolute right-3 top-3 z-10 bg-black/55 text-zinc-100 backdrop-blur-md">{isAdmin ? (event.eventState === "scheduled" ? `${event.confidence}% confianza` : eventStateLabels[event.eventState]) : event.categoryName}</Badge>
        <div className="absolute inset-x-0 bottom-0 z-10 p-4">
          <h2 className="line-clamp-2 text-lg font-semibold leading-tight tracking-tight text-white">{event.title}</h2>
          <p className="mt-2 line-clamp-3 text-xs leading-5 text-zinc-200">{event.description}</p>
        </div>
      </div>
      <CardContent className="p-4">
        {isAdmin && <div className="mb-4"><Badge variant="secondary">{event.categoryName}</Badge></div>}
        <div className={isAdmin ? "grid gap-2 border-t border-white/8 pt-4 text-xs text-zinc-400" : "grid gap-2 text-xs text-zinc-400"}>
          <span className="flex items-center gap-2"><CalendarDays className="size-4" />{formatEventSchedule(event)}</span>
          <span className="flex items-center gap-2"><MapPin className="size-4" />{event.city ?? "Chile"}{event.venue ? ` · ${event.venue}` : ""}</span>
          {event.priceLabel && <span className="flex items-center gap-2"><Ticket className="size-4" />{event.priceLabel}</span>}
        </div>
      </CardContent>
      <CardFooter className="mt-auto flex-wrap justify-between gap-2 px-4 pb-4"><small className="min-w-0 flex-1 truncate text-[11px] text-zinc-500">{event.sourceName}</small><div className="flex items-center gap-2">{event.sourceUrl && <Button asChild variant="ghost" size="sm"><a href={event.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Ir a la publicación de ${event.title}`}>Ir al evento <ExternalLink /></a></Button>}{onOpen && <Button variant="outline" size="sm" onClick={onOpen}>Detalles</Button>}</div></CardFooter>
    </Card>
  );
}
