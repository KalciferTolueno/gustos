import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date", withTimezone: true }),
  image: text("image"),
  credentialEmail: text("credential_email").unique(),
  passwordHash: text("password_hash"),
  city: text("city"),
  region: text("region"),
  role: text("role").notNull().default("user"),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [primaryKey({ columns: [table.provider, table.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
);

export const topics = pgTable(
  "topics",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    type: text("type").notNull(),
    parentId: integer("parent_id"),
    searchEnabled: boolean("search_enabled").notNull().default(true),
  },
  (table) => [index("topics_type_idx").on(table.type)],
);

export const userInterests = pgTable(
  "user_interests",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    topicId: integer("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.topicId] })],
);

export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  domain: text("domain").notNull().unique(),
  enabled: boolean("enabled").notNull().default(true),
  trust: integer("trust").notNull().default(50),
});

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    externalKey: text("external_key").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    startsAt: timestamp("starts_at", { mode: "date", withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { mode: "date", withTimezone: true }),
    city: text("city"),
    region: text("region"),
    venue: text("venue"),
    address: text("address"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    locationPrecision: text("location_precision").notNull().default("city"),
    modality: text("modality").notNull().default("in_person"),
    status: text("status").notNull().default("pending"),
    confidence: integer("confidence").notNull().default(0),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url").notNull(),
    imageUrl: text("image_url"),
    priceLabel: text("price_label"),
    submittedBy: text("submitted_by").references(() => users.id, { onDelete: "set null" }),
    discoveredByAi: boolean("discovered_by_ai").notNull().default(false),
    verifiedAt: timestamp("verified_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("events_external_key_idx").on(table.externalKey),
    index("events_starts_at_idx").on(table.startsAt),
    index("events_city_idx").on(table.city),
    index("events_status_idx").on(table.status),
  ],
);

export const eventTopics = pgTable(
  "event_topics",
  {
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    topicId: integer("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.topicId] })],
);

export const agentRuns = pgTable("agent_runs", {
  id: serial("id").primaryKey(),
  status: text("status").notNull(),
  searches: integer("searches").notNull().default(0),
  candidates: integer("candidates").notNull().default(0),
  published: integer("published").notNull().default(0),
  error: text("error"),
  startedAt: timestamp("started_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { mode: "date", withTimezone: true }),
});

export type EventRow = typeof events.$inferSelect;
