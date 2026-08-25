import { describe, expect, it } from "vitest";
import { acceptedEventState, eventDateRangesOverlap, eventHasNotEnded, eventIdentityKey, eventKey, isSpecificEventSourceUrl, normalizedSourceUrl, representativeEventTitle, sameEventOccurrence, sameEventRange, sameSourceOccurrence } from "./events";
import { eventDateRangeLabels, formatEventSchedule } from "./event-date-format";
import { matchesEventSearch } from "./event-search";
import { hashPassword, verifyPassword } from "./passwords";
import { coverageQueryDefinitions, normalizeDiscoveryQuery, queryIsFresh } from "./discovery-queries";
import { extractEventImage, extractEventImages, hasSupportedImageSignature, selectMatchingEventImage } from "./event-images";
import { agentUsage } from "./agent";
import { eventMapLocation } from "./event-map-location";
import { musicGenresFromLabels } from "./music-genres";
import { coordinatesAreInChile } from "./event-locations";
import { consultedWebUrls } from "./web-evidence";
import { sourceTextMatchesEventTitle } from "./event-source-validation";
import { CATALOG_AUDIT_VERSION, catalogAuditIsCurrent } from "./catalog-audit";

describe("eventKey", () => {
  it("normalizes title whitespace and case", () => {
    const date = new Date("2026-09-01T20:00:00Z");
    expect(eventKey("  Evento Techno ", date, "https://example.com/1")).toBe(
      eventKey("evento techno", date, "https://example.com/1"),
    );
  });

  it("distinguishes dates", () => {
    expect(eventKey("Evento", new Date("2026-09-01"), "https://example.com")).not.toBe(
      eventKey("Evento", new Date("2026-09-02"), "https://example.com"),
    );
  });

  it("normalizes identity text without merging recurring dates", () => {
    expect(eventIdentityKey("Festival Ñuble", new Date("2027-03-01T20:00:00Z"), "Chillán", "Teatro"))
      .not.toBe(eventIdentityKey("Festival Nuble", new Date("2027-03-15T20:00:00Z"), "Chillan", "Teatro"));
    expect(normalizedSourceUrl("https://www.example.com/evento/?utm_source=test#tickets")).toBe("https://example.com/evento?utm_source=test");
    expect(normalizedSourceUrl("https://www.example.com/evento/?utm_source=test#tickets", true)).toBe("https://example.com/evento");
    expect(normalizedSourceUrl("https://example.com/evento?id=1")).not.toBe(normalizedSourceUrl("https://example.com/evento?id=2"));
    expect(isSpecificEventSourceUrl("https://tickets.example.com/evento/123")).toBe(true);
    expect(isSpecificEventSourceUrl("https://tickets.example.com/")).toBe(false);
    expect(isSpecificEventSourceUrl("https://www.puntoticket.com/todos?direct=true")).toBe(false);
    expect(isSpecificEventSourceUrl("https://www.puntoticket.com/creamfields-2026")).toBe(true);
    expect(isSpecificEventSourceUrl("https://www.ogts.cl/ogts.php?p=santiago-en-foco-ya-tiene-ganadores")).toBe(false);
    expect(isSpecificEventSourceUrl("https://www.lolytafest.cl/", "LOLYTA FEST 2026")).toBe(true);
    expect(isSpecificEventSourceUrl("https://www.lolytafest.cl/", "Otro festival")).toBe(false);
    expect(eventIdentityKey("Función", new Date("2027-03-01T20:00:00Z"), "Chillán", "Teatro"))
      .not.toBe(eventIdentityKey("Función", new Date("2027-03-01T22:00:00Z"), "Chillán", "Teatro"));
    expect(eventIdentityKey("RushCon 2026", new Date("2027-03-01T20:00:00Z"), "Santiago", "Centro Cultural"))
      .toBe(eventIdentityKey("rushcon 2026", new Date("2027-03-01T20:00:00Z"), "Santiago", "Centro Cultural"));
    expect(eventIdentityKey("RushCon 2026", new Date("2027-03-01T20:00:00Z"), "Santiago", "Centro Cultural"))
      .not.toBe(eventIdentityKey("RushCon 2026", new Date("2027-03-01T20:00:00Z"), "Valparaíso", "Centro Cultural"));
    const occurrence = { title: "RushCon 2026", startsAt: new Date("2027-03-01T20:00:00Z"), city: "Santiago" };
    expect(sameEventOccurrence({ ...occurrence, venue: "Centro Cultural" }, { ...occurrence, venue: "Centro Cultural de Santiago" })).toBe(true);
    expect(sameEventOccurrence(
      { title: "Expo Game 2026", startsAt: new Date("2026-10-02T15:00:00Z"), timePrecision: "exact", city: "Santiago", venue: "Estación Mapocho" },
      { title: "ExpoGame 2026", startsAt: new Date("2026-10-02T16:00:00Z"), timePrecision: "exact", city: "Santiago", venue: "Centro Cultural Estación Mapocho" },
    )).toBe(true);
    expect(sameEventOccurrence({ ...occurrence, venue: "Cine A" }, { ...occurrence, venue: "Cine B" })).toBe(false);
    expect(sameEventOccurrence(
      { ...occurrence, startsAt: new Date("2027-03-01T13:00:00Z"), venue: "Centro Cultural" },
      { ...occurrence, title: "RushCon 2026 — El Multiverso Friki Más Grande de Chile", startsAt: new Date("2027-03-01T16:00:00Z"), venue: null },
    )).toBe(true);
    expect(sameEventOccurrence(
      { ...occurrence, startsAt: new Date("2027-03-01T12:00:00Z"), timePrecision: "date", venue: "Espacio Vicente Valdés" },
      { ...occurrence, startsAt: new Date("2027-03-01T16:00:00Z"), timePrecision: "exact", city: "La Florida", venue: "Espacio Vicente Valdés" },
    )).toBe(true);
    expect(sameEventOccurrence({ ...occurrence, startsAt: new Date("2027-03-01T13:00:00Z") }, { ...occurrence, startsAt: new Date("2027-03-01T16:00:00Z") })).toBe(false);
    const regionalSource = "https://tcgnews.cl/noticia/bandai-card-games-tendra-cinco-regionales-en-chile-durante-septiembre";
    const regional = { startsAt: new Date("2026-09-12T13:00:00Z"), timePrecision: "exact", city: "Santiago", venue: "Hotel Gran Palace", sourceUrl: regionalSource };
    expect(sameSourceOccurrence(regional, { ...regional, startsAt: new Date("2026-09-12T12:00:00Z"), timePrecision: "date" })).toBe(true);
    expect(sameSourceOccurrence(regional, { ...regional, startsAt: new Date("2026-09-13T13:00:00Z") })).toBe(false);
    expect(sameSourceOccurrence(regional, { ...regional, startsAt: new Date("2026-09-12T16:00:00Z") })).toBe(true);
    expect(representativeEventTitle([
      "Dragon Ball Super Card Game: Fusion World Championship 26-27 Regional September Wave 2",
      "Digimon Card Game 26-27 Regionals September",
      "Regionales Bandai Card Games — Digimon y Dragon Ball Super Card Game Fusion World",
    ])).toBe("Regionales Bandai Card Games — Digimon y Dragon Ball Super Card Game Fusion World");
  });
});

describe("discovery query cache", () => {
  it("normalizes equivalent searches and recognizes a fresh result", () => {
    expect(normalizeDiscoveryQuery("  Música   Ñuble ")).toBe("musica nuble");
    expect(queryIsFresh({ lastRefreshedAt: new Date() })).toBe(true);
    expect(queryIsFresh({ lastRefreshedAt: new Date(Date.now() - 25 * 60 * 60_000) })).toBe(false);
    expect(queryIsFresh({ lastRefreshedAt: new Date(Date.now() - 3 * 60_000), lastResultCount: 0 })).toBe(false);
  });

  it("splits national coverage into date-specific quarters covering the next year", () => {
    const queries = coverageQueryDefinitions(new Date("2026-08-24T12:00:00Z"));
    expect(queries).toHaveLength(16 * 20 * 5);
    expect(new Set(queries.map((query) => query.normalizedQuery)).size).toBe(queries.length);
    expect(new Set(queries.map((query) => query.displayQuery.match(/entre (.+)$/)?.[1])).size).toBe(5);
    expect(queries[0].displayQuery).toContain("entre 2026-07-01 y 2026-09-30");
    expect(queries.at(-1)?.displayQuery).toContain("entre 2027-07-01 y 2027-09-30");
  });
});

describe("agent telemetry", () => {
  it("estimates token and web search cost in microdollars", () => {
    process.env.OPENAI_INPUT_USD_PER_MILLION = "2";
    process.env.OPENAI_OUTPUT_USD_PER_MILLION = "10";
    process.env.OPENAI_WEB_SEARCH_USD = "0.01";
    expect(agentUsage({ input_tokens: 100, output_tokens: 10 }, 2).estimatedCostMicros).toBe(20_300);
  });
});

describe("event timing", () => {
  it("keeps today's events visible until the Chilean calendar day ends", () => {
    const now = new Date("2026-08-23T16:00:00Z");
    expect(eventHasNotEnded(new Date("2026-08-21T16:00:00Z"), new Date("2026-08-23T23:00:00Z"), now)).toBe(true);
    expect(eventHasNotEnded(new Date("2026-08-21T16:00:00Z"), new Date("2026-08-22T23:00:00Z"), now)).toBe(false);
    expect(eventHasNotEnded(new Date("2026-08-23T12:00:00Z"), null, new Date("2026-08-24T02:30:00Z"))).toBe(true);
    expect(eventHasNotEnded(new Date("2026-08-22T23:30:00Z"), null, new Date("2026-08-24T02:30:00Z"))).toBe(false);
  });

  it("formats a multi-year exhibition as a complete range", () => {
    const exhibition = {
      startsAt: new Date("2025-07-10T14:00:00Z"),
      endsAt: new Date("2027-07-31T22:30:00Z"),
      timePrecision: "exact",
    };
    expect(eventDateRangeLabels(exhibition)).toEqual({ start: "10 jul 2025", end: "31 jul 2027" });
    expect(formatEventSchedule(exhibition)).toContain("10 jul 2025");
    expect(formatEventSchedule(exhibition)).toContain("31 jul 2027");
  });

  it("matches duplicate listings inside the same published date range", () => {
    const exhibition = {
      title: "Roberto Matta. Abrir la mirada",
      startsAt: new Date("2025-07-10T14:00:00Z"),
      endsAt: new Date("2027-07-31T22:30:00Z"),
      city: "Santiago",
      venue: "Museo Nacional de Bellas Artes",
      sourceUrl: "https://www.mnba.gob.cl/cartelera/roberto-matta-abrir-la-mirada",
    };
    const duplicate = { ...exhibition, startsAt: new Date("2026-08-24T14:00:00Z"), endsAt: null };
    const laterOccurrence = { ...exhibition, startsAt: new Date("2028-07-10T14:00:00Z"), endsAt: null };
    expect(eventDateRangesOverlap(exhibition, duplicate)).toBe(true);
    expect(sameEventRange(exhibition, duplicate)).toBe(true);
    expect(sameEventRange(exhibition, laterOccurrence)).toBe(false);
  });
});

describe("event images", () => {
  it("extracts an official social image regardless of attribute order", () => {
    expect(extractEventImage('<meta content="/pawstral.jpg?size=large&amp;v=2" property="og:image">', "https://pawstral.cl/evento"))
      .toBe("https://pawstral.cl/pawstral.jpg?size=large&v=2");
  });

  it("collects structured, social, and page images for AI selection", () => {
    const html = '<script type="application/ld+json">{"@type":"Event","image":"/poster.jpg"}</script><meta property="og:image" content="/social.webp"><img data-src="/gallery.png"><div style="background-image:url(\'/background.jpg\')"></div>';
    expect(extractEventImages(html, "https://example.com/evento")).toEqual([
      "https://example.com/poster.jpg",
      "https://example.com/social.webp",
      "https://example.com/gallery.png",
      "https://example.com/background.jpg",
    ]);
  });

  it("rejects HTML and accepts real image signatures", () => {
    expect(hasSupportedImageSignature(Buffer.from("<!doctype html><html>"))).toBe(false);
    expect(hasSupportedImageSignature(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(hasSupportedImageSignature(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
  });

  it("does not use an arbitrary image when the AI verifier is unavailable", async () => {
    const savedKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      await expect(selectMatchingEventImage("The Grid: Outworld — Klangkuenstler All Night Long", ["https://www.puntoticket.com/todos?direct=true"]))
        .resolves.toBeNull();
    } finally {
      if (savedKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = savedKey;
    }
  });
});

describe("event verification", () => {
  it("re-runs the catalog audit when its rule version increases", () => {
    expect(catalogAuditIsCurrent(CATALOG_AUDIT_VERSION)).toBe(true);
    expect(catalogAuditIsCurrent(CATALOG_AUDIT_VERSION - 1)).toBe(false);
  });

  it("requires the live page content to contain the event title", () => {
    expect(sourceTextMatchesEventTitle('<title>Santiago en Foco</title><main>Exposición fotográfica en el Palacio Consistorial</main>', "Santiago en Foco — exposición fotográfica")).toBe(true);
    expect(sourceTextMatchesEventTitle('<title>OGTS ED DADILAPICINUM</title><img alt="María Corina Machado y Mario Desbordes">', "Santiago en Foco — exposición fotográfica")).toBe(false);
  });

  it("requires an official source or an independent cancellation", () => {
    expect(acceptedEventState("cancelled", false, false)).toBeNull();
    expect(acceptedEventState("cancelled", false, true)).toBe("cancelled");
    expect(acceptedEventState("postponed", false, true)).toBeNull();
    expect(acceptedEventState("scheduled", true, false)).toBe("scheduled");
  });

  it("recognizes searched, opened, inspected, and cited web pages", () => {
    expect([...consultedWebUrls([
      { type: "web_search_call", action: { type: "search", sources: [{ url: "https://example.com/search-result" }] } },
      { type: "web_search_call", action: { type: "open_page", url: "https://example.com/event" } },
      { type: "web_search_call", action: { type: "find_in_page", url: "https://example.com/details" } },
      { type: "message", content: [{ annotations: [{ type: "url_citation", url: "https://example.com/citation" }] }] },
    ])]).toEqual([
      "https://example.com/search-result",
      "https://example.com/event",
      "https://example.com/details",
      "https://example.com/citation",
    ]);
  });
});

describe("passwords", () => {
  it("hashes with a random salt and verifies safely", async () => {
    const first = await hashPassword("correct-horse-42");
    const second = await hashPassword("correct-horse-42");
    expect(first).not.toBe(second);
    await expect(verifyPassword("correct-horse-42", first)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", first)).resolves.toBe(false);
  });
});

describe("matchesEventSearch", () => {
  it("matches unaccented multi-word queries across event details", () => {
    const event = {
      title: "Charlotte de Witte",
      description: "Festival de música electrónica",
      city: "Viña del Mar",
      region: "Valparaíso",
      venue: "Quinta Vergara",
      address: null,
      topicNames: ["Techno"],
    } as Parameters<typeof matchesEventSearch>[0];
    expect(matchesEventSearch(event, "musica vina")).toBe(true);
    expect(matchesEventSearch(event, "charlotte techno")).toBe(true);
    expect(matchesEventSearch(event, "furry")).toBe(false);
  });
});

describe("event map locations", () => {
  it("only maps coordinates verified as exact", () => {
    expect(eventMapLocation({ latitude: -33.45, longitude: -70.66, locationPrecision: "exact" })).toEqual({ position: [-33.45, -70.66] });
    expect(eventMapLocation({ latitude: -33.45, longitude: -70.66, locationPrecision: "city" })).toBeNull();
    expect(eventMapLocation({ locationPrecision: "unknown" })).toBeNull();
  });

  it("rejects coordinates outside Chile before publishing a marker", () => {
    expect(coordinatesAreInChile(-33.4489, -70.6693)).toBe(true);
    expect(coordinatesAreInChile(-27.1127, -109.3497)).toBe(true);
    expect(coordinatesAreInChile(0, 0)).toBe(false);
  });
});

describe("music genre filters", () => {
  it("keeps genres and excludes artist names and generic activities", () => {
    expect(musicGenresFromLabels(["Klangkuenstler", "Música electrónica/techno", "fiesta", "BTS", "K-pop"])).toEqual(["Electrónica", "Techno", "K-pop"]);
  });
});
