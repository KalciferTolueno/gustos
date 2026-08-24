import {
  boolean,
  doublePrecision,
  foreignKey,
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
  (table) => [
    foreignKey({ columns: [table.parentId], foreignColumns: [table.id] }).onDelete("set null"),
    index("topics_type_idx").on(table.type),
    index("topics_parent_idx").on(table.parentId),
  ],
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
    identityKey: text("identity_key"),
    categoryId: integer("category_id").references(() => topics.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    startsAt: timestamp("starts_at", { mode: "date", withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { mode: "date", withTimezone: true }),
    timePrecision: text("time_precision").notNull().default("exact"),
    city: text("city"),
    region: text("region"),
    venue: text("venue"),
    address: text("address"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    locationPrecision: text("location_precision").notNull().default("city"),
    modality: text("modality").notNull().default("in_person"),
    status: text("status").notNull().default("pending"),
    eventState: text("event_state").notNull().default("scheduled"),
    statusReason: text("status_reason"),
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
    uniqueIndex("events_identity_key_idx").on(table.identityKey),
    index("events_starts_at_idx").on(table.startsAt),
    index("events_city_idx").on(table.city),
    index("events_status_idx").on(table.status),
    index("events_category_idx").on(table.categoryId),
  ],
);

export const eventTopics = pgTable(
  "event_topics",
  {
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    topicId: integer("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.topicId] }), index("event_topics_topic_idx").on(table.topicId, table.eventId)],
);

export const agentRuns = pgTable("agent_runs", {
  id: serial("id").primaryKey(),
  status: text("status").notNull(),
  searches: integer("searches").notNull().default(0),
  candidates: integer("candidates").notNull().default(0),
  published: integer("published").notNull().default(0),
  error: text("error"),
  kind: text("kind").notNull().default("discovery"),
  target: text("target"),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  estimatedCostMicros: integer("estimated_cost_micros").notNull().default(0),
  startedAt: timestamp("started_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { mode: "date", withTimezone: true }),
});

export const discoveryQueries = pgTable(
  "discovery_queries",
  {
    id: serial("id").primaryKey(),
    normalizedQuery: text("normalized_query").notNull().unique(),
    displayQuery: text("display_query").notNull(),
    kind: text("kind").notNull().default("user"),
    categorySlug: text("category_slug"),
    region: text("region"),
    requestCount: integer("request_count").notNull().default(0),
    status: text("status").notNull().default("queued"),
    lastRequestedAt: timestamp("last_requested_at", { mode: "date", withTimezone: true }),
    lastRefreshedAt: timestamp("last_refreshed_at", { mode: "date", withTimezone: true }),
    nextRefreshAt: timestamp("next_refresh_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    lastResultCount: integer("last_result_count").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("discovery_queries_refresh_idx").on(table.nextRefreshAt), index("discovery_queries_kind_idx").on(table.kind)],
);

export const discoveryQueryEvents = pgTable(
  "discovery_query_events",
  {
    queryId: integer("query_id").notNull().references(() => discoveryQueries.id, { onDelete: "cascade" }),
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.queryId, table.eventId] })],
);

export const searchRequests = pgTable(
  "search_requests",
  {
    id: serial("id").primaryKey(),
    queryId: integer("query_id").references(() => discoveryQueries.id, { onDelete: "set null" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    requesterHash: text("requester_hash").notNull(),
    cacheHit: boolean("cache_hit").notNull().default(false),
    searches: integer("searches").notNull().default(0),
    resultCount: integer("result_count").notNull().default(0),
    status: text("status").notNull().default("succeeded"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("search_requests_created_idx").on(table.createdAt), index("search_requests_query_idx").on(table.queryId)],
);

export const eventSources = pgTable(
  "event_sources",
  {
    id: serial("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    normalizedUrl: text("normalized_url").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    status: text("status").notNull().default("active"),
    firstSeenAt: timestamp("first_seen_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    lastCheckedAt: timestamp("last_checked_at", { mode: "date", withTimezone: true }),
    nextCheckAt: timestamp("next_check_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    lastHttpStatus: integer("last_http_status"),
    contentHash: text("content_hash"),
  },
  (table) => [uniqueIndex("event_sources_event_url_idx").on(table.eventId, table.normalizedUrl), index("event_sources_check_idx").on(table.nextCheckAt)],
);

export const eventSourceObservations = pgTable(
  "event_source_observations",
  {
    id: serial("id").primaryKey(),
    eventSourceId: integer("event_source_id").notNull().references(() => eventSources.id, { onDelete: "cascade" }),
    observedTitle: text("observed_title"),
    observedStartsAt: timestamp("observed_starts_at", { mode: "date", withTimezone: true }),
    observedEndsAt: timestamp("observed_ends_at", { mode: "date", withTimezone: true }),
    observedVenue: text("observed_venue"),
    observedState: text("observed_state").notNull().default("scheduled"),
    confidence: integer("confidence").notNull().default(0),
    isOfficial: boolean("is_official").notNull().default(false),
    evidence: text("evidence"),
    checkedAt: timestamp("checked_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("event_source_observations_source_idx").on(table.eventSourceId, table.checkedAt)],
);

export type EventRow = typeof events.$inferSelect;
