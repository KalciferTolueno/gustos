import { describe, expect, it } from "vitest";
import { acceptedEventState, eventHasNotEnded, eventIdentityKey, eventKey, normalizedSourceUrl } from "./events";
import { matchesEventSearch } from "./event-search";
import { hashPassword, verifyPassword } from "./passwords";
import { normalizeDiscoveryQuery, queryIsFresh } from "./discovery-queries";

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
    expect(eventIdentityKey("Festival Ñuble", new Date("2027-03-01T20:00:00Z"), "Teatro", "Chillán"))
      .not.toBe(eventIdentityKey("Festival Nuble", new Date("2027-03-15T20:00:00Z"), "Teatro", "Chillan"));
    expect(normalizedSourceUrl("https://www.example.com/evento/?utm_source=test#tickets")).toBe("https://example.com/evento?utm_source=test");
    expect(normalizedSourceUrl("https://www.example.com/evento/?utm_source=test#tickets", true)).toBe("https://example.com/evento");
    expect(normalizedSourceUrl("https://example.com/evento?id=1")).not.toBe(normalizedSourceUrl("https://example.com/evento?id=2"));
  });
});

describe("discovery query cache", () => {
  it("normalizes equivalent searches and recognizes a fresh result", () => {
    expect(normalizeDiscoveryQuery("  Música   Ñuble ")).toBe("musica nuble");
    expect(queryIsFresh({ lastRefreshedAt: new Date() })).toBe(true);
    expect(queryIsFresh({ lastRefreshedAt: new Date(Date.now() - 25 * 60 * 60_000) })).toBe(false);
    expect(queryIsFresh({ lastRefreshedAt: new Date(Date.now() - 3 * 60_000), lastResultCount: 0 })).toBe(false);
  });
});

describe("event timing", () => {
  it("keeps an event visible while its end date is still in the future", () => {
    const now = new Date("2026-08-23T16:00:00Z");
    expect(eventHasNotEnded(new Date("2026-08-21T16:00:00Z"), new Date("2026-08-23T23:00:00Z"), now)).toBe(true);
    expect(eventHasNotEnded(new Date("2026-08-21T16:00:00Z"), new Date("2026-08-22T23:00:00Z"), now)).toBe(false);
  });
});

describe("event verification", () => {
  it("requires an official source or an independent cancellation", () => {
    expect(acceptedEventState("cancelled", false, false)).toBeNull();
    expect(acceptedEventState("cancelled", false, true)).toBe("cancelled");
    expect(acceptedEventState("postponed", false, true)).toBeNull();
    expect(acceptedEventState("scheduled", true, false)).toBe("scheduled");
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
