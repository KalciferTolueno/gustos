const chileTimeZone = "America/Santiago";

const shortDateFormatter = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: chileTimeZone,
});

const fullDateFormatter = new Intl.DateTimeFormat("es-CL", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: chileTimeZone,
});

const dateOnlyFormatter = new Intl.DateTimeFormat("es-CL", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: chileTimeZone,
});

const timeFormatter = new Intl.DateTimeFormat("es-CL", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: chileTimeZone,
});

type EventSchedule = {
  startsAt: Date | string;
  endsAt: Date | string | null;
  timePrecision: string;
};

export function eventDateRangeLabels(event: Pick<EventSchedule, "startsAt" | "endsAt">) {
  const startsAt = new Date(event.startsAt);
  const start = shortDateFormatter.format(startsAt);
  if (!event.endsAt) return { start, end: null };
  const end = shortDateFormatter.format(new Date(event.endsAt));
  return { start, end: end === start ? null : end };
}

export function formatEventSchedule(event: EventSchedule) {
  const startsAt = new Date(event.startsAt);
  const endsAt = event.endsAt ? new Date(event.endsAt) : null;
  const startDay = shortDateFormatter.format(startsAt);
  const endDay = endsAt ? shortDateFormatter.format(endsAt) : null;

  if (event.timePrecision === "date") {
    const start = dateOnlyFormatter.format(startsAt);
    if (!endsAt || endDay === startDay) return `${start} · Horario por confirmar`;
    return `${start} – ${dateOnlyFormatter.format(endsAt)} · Horario por confirmar`;
  }

  const start = fullDateFormatter.format(startsAt);
  if (!endsAt) return start;
  if (endDay === startDay) return `${start} – ${timeFormatter.format(endsAt)}`;
  return `${start} – ${fullDateFormatter.format(endsAt)}`;
}
