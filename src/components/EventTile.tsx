"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import Image from "next/image";
import { CalendarDays, ExternalLink, MapPin, Ticket } from "lucide-react";
import { formatEventSchedule } from "@/lib/event-date-format";
import type { EventCard } from "@/lib/events";
import { EventImageFallback } from "@/components/EventImageFallback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

const eventStateLabels: Record<string, string> = { scheduled: "Programado", postponed: "Postergado", cancelled: "Cancelado", completed: "Finalizado" };

export function EventTile({ event, index, featured = false, isAdmin, onOpen }: { event: EventCard; index: number; featured?: boolean; isAdmin: boolean; onOpen?: () => void }) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const image = event.imageUrl && event.imageUrl !== failedImageUrl ? event.imageUrl : null;
  return (
    <Card className={`event-tile gap-0 overflow-hidden ${featured ? "event-tile-featured sm:col-span-2" : ""}`} style={{ "--tile-hue": `${190 + (index % 5) * 28}`, "--entry-delay": `${Math.min(index, 4) * 45}ms` } as CSSProperties}>
      <div className={`event-visual relative overflow-hidden ${featured ? "min-h-80" : "h-64"}`}>
        {image && <Image src={image} alt="" fill unoptimized priority={index === 0} sizes={featured ? "(max-width: 640px) 100vw, (max-width: 1280px) 66vw, 50vw" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"} className="z-0 object-cover" onError={() => setFailedImageUrl(image)} />}
        {!image && <EventImageFallback categoryName={event.categoryName} />}
        <div className="absolute inset-x-0 bottom-0 z-10 p-4">
          <h2 className={`line-clamp-2 font-semibold leading-tight tracking-tight text-white ${featured ? "text-2xl sm:text-3xl" : "text-lg"}`}>{event.title}</h2>
          <p className={`mt-2 text-zinc-200 ${featured ? "line-clamp-2 max-w-2xl text-sm leading-6" : "line-clamp-3 text-xs leading-5"}`}>{event.description}</p>
        </div>
      </div>
      <CardContent className="p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2"><Badge variant="secondary">{event.categoryName}</Badge>{isAdmin && <Badge variant="outline">{event.eventState === "scheduled" ? `${event.confidence}% confianza` : eventStateLabels[event.eventState]}</Badge>}</div>
        <div className="grid gap-2 border-t border-white/8 pt-4 text-xs text-zinc-400">
          <span className="flex items-center gap-2"><CalendarDays aria-hidden="true" className="size-4" /><time dateTime={new Date(event.startsAt).toISOString()}>{formatEventSchedule(event)}</time></span>
          <span className="flex items-center gap-2"><MapPin aria-hidden="true" className="size-4" />{event.city ?? "Chile"}{event.venue ? `, ${event.venue}` : ""}</span>
          {event.priceLabel && <span className="flex items-center gap-2"><Ticket aria-hidden="true" className="size-4" />{event.priceLabel}</span>}
        </div>
      </CardContent>
      <CardFooter className="mt-auto flex-wrap justify-between gap-2 px-4 pb-4"><small className="min-w-0 flex-1 truncate text-[11px] text-zinc-500">{event.sourceName}</small><div className="flex items-center gap-2">{event.sourceUrl && <Button asChild variant="ghost" size="sm"><a href={event.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Ir a la publicación de ${event.title}`}>Ir al evento <ExternalLink aria-hidden="true" /></a></Button>}{onOpen && <Button variant="outline" size="sm" onClick={onOpen}>Detalles</Button>}</div></CardFooter>
    </Card>
  );
}
