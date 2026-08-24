import { describe, expect, it } from "vitest";
import { acceptedEventState, eventHasNotEnded, eventIdentityKey, eventKey, isSpecificEventSourceUrl, normalizedSourceUrl, representativeEventTitle, sameEventOccurrence, sameSourceOccurrence } from "./events";
import { matchesEventSearch } from "./event-search";
import { hashPassword, verifyPassword } from "./passwords";
import { coverageQueryDefinitions, normalizeDiscoveryQuery, queryIsFresh } from "./discovery-queries";
import { extractEventImage, extractEventImages, hasSupportedImageSignature } from "./event-images";
import { agentUsage } from "./agent";
import { eventMapLocation } from "./event-map-location";
import { consultedWebUrls } from "./web-evidence";

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
    expect(sameSourceOccurrence(regional, { ...regional, startsAt: new Date("2026-09-12T16:00:00Z") })).toBe(false);
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
  it("keeps an event visible while its end date is still in the future", () => {
    const now = new Date("2026-08-23T16:00:00Z");
    expect(eventHasNotEnded(new Date("2026-08-21T16:00:00Z"), new Date("2026-08-23T23:00:00Z"), now)).toBe(true);
    expect(eventHasNotEnded(new Date("2026-08-21T16:00:00Z"), new Date("2026-08-22T23:00:00Z"), now)).toBe(false);
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
});

describe("event verification", () => {
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
  it("uses exact coordinates when available and a labeled city fallback otherwise", () => {
    expect(eventMapLocation({ id: "exact", city: "Santiago", latitude: -33.45, longitude: -70.66 })).toEqual({ position: [-33.45, -70.66], approximate: false });
    expect(eventMapLocation({ id: "fallback", city: "Valparaíso" })?.approximate).toBe(true);
    expect(eventMapLocation({ id: "unknown", city: "En algún lugar" })).toBeNull();
  });
});
