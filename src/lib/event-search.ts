import type { EventCard } from "./events";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CL");
}

export function matchesEventSearch(event: EventCard, query: string) {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = normalize([
    event.title,
    event.description,
    event.city,
    event.region,
    event.venue,
    event.address,
    ...event.topicNames,
  ].filter(Boolean).join(" "));
  return terms.every((term) => haystack.includes(term));
}
