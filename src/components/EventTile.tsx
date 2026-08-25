"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
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
  const tileRef = useRef<HTMLDivElement>(null);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [mayLoadImage, setMayLoadImage] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const image = event.imageUrl && event.imageUrl !== failedImageUrl ? event.imageUrl : null;

  useEffect(() => {
    const tile = tileRef.current;
    if (!tile) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frame = window.requestAnimationFrame(() => setIsVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setIsVisible(true);
      observer.disconnect();
    }, { rootMargin: "120px 0px", threshold: 0.08 });

    observer.observe(tile);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || !image) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setMayLoadImage(true), reducedMotion ? 0 : 160 + (index % 5) * 130);
    return () => window.clearTimeout(timer);
  }, [image, index, isVisible]);

  return (
    <Card ref={tileRef} className={`event-tile relative gap-0 overflow-hidden ${isVisible ? "event-tile-visible" : ""} ${onOpen ? "event-tile-openable" : ""} ${featured ? "event-tile-featured sm:col-span-2" : ""}`} style={{ "--tile-hue": `${190 + (index % 5) * 28}`, "--entry-delay": `${(index % 5) * 95}ms` } as CSSProperties}>
      {onOpen && <button type="button" className="event-card-trigger absolute inset-0 z-20 rounded-[inherit]" onClick={onOpen} aria-label={`Ver detalles de ${event.title}`} />}
      <div className={`event-visual relative overflow-hidden ${featured ? "min-h-80" : "h-64"}`}>
        {image && !imageLoaded && <div className="event-image-skeleton" aria-hidden="true" />}
        {image && mayLoadImage && <Image src={image} alt="" fill unoptimized loading={index === 0 ? "eager" : "lazy"} decoding="async" sizes={featured ? "(max-width: 640px) 100vw, (max-width: 1280px) 66vw, 50vw" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"} className={`event-image z-0 object-cover ${imageLoaded ? "event-image-loaded" : ""}`} onLoad={() => setImageLoaded(true)} onError={() => setFailedImageUrl(image)} />}
        {!image && <EventImageFallback categoryName={event.categoryName} />}
        <Badge variant="secondary" className="pointer-events-none absolute left-4 top-4 z-10 border-white/10 bg-black/45 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.12)] backdrop-blur-xl">{event.categoryName}</Badge>
        <div className="absolute inset-x-0 bottom-0 z-10 p-4">
          <h2 className={`line-clamp-2 font-semibold leading-tight tracking-tight text-white ${featured ? "text-2xl sm:text-3xl" : "text-lg"}`}>{event.title}</h2>
          <p className={`mt-2 text-zinc-200 ${featured ? "line-clamp-2 max-w-2xl text-sm leading-6" : "line-clamp-3 text-xs leading-5"}`}>{event.description}</p>
        </div>
      </div>
      <CardContent className="event-card-body relative z-10 -mt-px p-4">
        {isAdmin && <div className="mb-4 flex flex-wrap items-center gap-2"><Badge variant="outline">{event.eventState === "scheduled" ? `${event.confidence}% confianza` : eventStateLabels[event.eventState]}</Badge></div>}
        <div className={`grid gap-2 text-xs text-zinc-400 ${isAdmin ? "border-t border-white/8 pt-4" : ""}`}>
          <span className="flex items-center gap-2"><CalendarDays aria-hidden="true" className="size-4" /><time dateTime={new Date(event.startsAt).toISOString()}>{formatEventSchedule(event)}</time></span>
          <span className="flex items-center gap-2"><MapPin aria-hidden="true" className="size-4" />{event.city ?? "Chile"}{event.venue ? `, ${event.venue}` : ""}</span>
          {event.priceLabel && <span className="flex items-center gap-2"><Ticket aria-hidden="true" className="size-4" />{event.priceLabel}</span>}
        </div>
      </CardContent>
      <CardFooter className="event-card-body mt-auto flex-wrap justify-between gap-2 px-4 pb-4"><small className="min-w-0 flex-1 truncate text-[11px] text-zinc-500">{event.sourceName}</small>{event.sourceUrl && <Button asChild variant="ghost" size="sm" className="relative z-30"><a href={event.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Ir a la publicación de ${event.title}`}>Ir al evento <ExternalLink aria-hidden="true" /></a></Button>}</CardFooter>
    </Card>
  );
}
