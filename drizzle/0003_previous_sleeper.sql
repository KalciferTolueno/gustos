CREATE TABLE "discovery_queries" (
	"id" serial PRIMARY KEY NOT NULL,
	"normalized_query" text NOT NULL,
	"display_query" text NOT NULL,
	"kind" text DEFAULT 'user' NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"last_requested_at" timestamp with time zone,
	"last_refreshed_at" timestamp with time zone,
	"next_refresh_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_result_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discovery_queries_normalized_query_unique" UNIQUE("normalized_query")
);
--> statement-breakpoint
CREATE TABLE "discovery_query_events" (
	"query_id" integer NOT NULL,
	"event_id" text NOT NULL,
	CONSTRAINT "discovery_query_events_query_id_event_id_pk" PRIMARY KEY("query_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "event_source_observations" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_source_id" integer NOT NULL,
	"observed_title" text,
	"observed_starts_at" timestamp with time zone,
	"observed_ends_at" timestamp with time zone,
	"observed_venue" text,
	"observed_state" text DEFAULT 'scheduled' NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL,
	"is_official" boolean DEFAULT false NOT NULL,
	"evidence" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"normalized_url" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_checked_at" timestamp with time zone,
	"next_check_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_http_status" integer,
	"content_hash" text
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "kind" text DEFAULT 'discovery' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "target" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "identity_key" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "event_state" text DEFAULT 'scheduled' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "status_reason" text;--> statement-breakpoint
ALTER TABLE "discovery_query_events" ADD CONSTRAINT "discovery_query_events_query_id_discovery_queries_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."discovery_queries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_query_events" ADD CONSTRAINT "discovery_query_events_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_source_observations" ADD CONSTRAINT "event_source_observations_event_source_id_event_sources_id_fk" FOREIGN KEY ("event_source_id") REFERENCES "public"."event_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_sources" ADD CONSTRAINT "event_sources_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discovery_queries_refresh_idx" ON "discovery_queries" USING btree ("next_refresh_at");--> statement-breakpoint
CREATE INDEX "discovery_queries_kind_idx" ON "discovery_queries" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "event_source_observations_source_idx" ON "event_source_observations" USING btree ("event_source_id","checked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "event_sources_event_url_idx" ON "event_sources" USING btree ("event_id","normalized_url");--> statement-breakpoint
CREATE INDEX "event_sources_check_idx" ON "event_sources" USING btree ("next_check_at");--> statement-breakpoint
WITH normalized AS (
	SELECT "id", "created_at", md5(
		trim(regexp_replace(lower(regexp_replace(normalize(coalesce("title", ''), NFD), U&'[\0300-\036F]', '', 'g')), '[^a-z0-9]+', ' ', 'g')) || '|' ||
		trim(regexp_replace(lower(regexp_replace(normalize(coalesce("venue", ''), NFD), U&'[\0300-\036F]', '', 'g')), '[^a-z0-9]+', ' ', 'g')) || '|' ||
		trim(regexp_replace(lower(regexp_replace(normalize(coalesce("city", ''), NFD), U&'[\0300-\036F]', '', 'g')), '[^a-z0-9]+', ' ', 'g')) || '|' ||
		to_char("starts_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
	) AS identity_key
	FROM "events"
), ranked AS (
	SELECT *, row_number() OVER (PARTITION BY identity_key ORDER BY "created_at", "id") AS duplicate_number
	FROM normalized
)
UPDATE "events" SET "identity_key" = ranked.identity_key
FROM ranked
WHERE "events"."id" = ranked."id" AND ranked.duplicate_number = 1;
--> statement-breakpoint
CREATE UNIQUE INDEX "events_identity_key_idx" ON "events" USING btree ("identity_key");
--> statement-breakpoint
INSERT INTO "sources" ("name", "domain", "enabled", "trust") VALUES
	('Ticketmaster Chile', 'ticketmaster.cl', true, 90),
	('PuntoTicket', 'puntoticket.com', true, 90),
	('Passline', 'passline.com', true, 90),
	('Eventrid', 'eventrid.cl', true, 90),
	('Ticketplus', 'ticketplus.cl', true, 90)
ON CONFLICT ("domain") DO NOTHING;
--> statement-breakpoint
WITH existing_events AS (
	SELECT *, regexp_replace(split_part("source_url", '#', 1), '/$', '') AS cleaned_url
	FROM "events"
	WHERE "source_url" <> ''
)
INSERT INTO "event_sources" ("event_id", "name", "url", "normalized_url", "is_primary", "last_checked_at", "next_check_at")
SELECT "id", "source_name", "source_url",
	CASE WHEN cleaned_url ~* '^https?://' THEN
		regexp_replace(lower(substring(cleaned_url from '^[^:]+://[^/?#]+')), '://www\.', '://') || substring(cleaned_url from char_length(substring(cleaned_url from '^[^:]+://[^/?#]+')) + 1)
	ELSE cleaned_url END,
	true, "verified_at", now()
FROM existing_events
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "event_source_observations" ("event_source_id", "observed_title", "observed_starts_at", "observed_ends_at", "observed_venue", "observed_state", "confidence", "evidence", "checked_at")
SELECT source."id", event."title", event."starts_at", event."ends_at", event."venue", 'scheduled', event."confidence", 'Migrated from the original event source', coalesce(event."verified_at", event."created_at")
FROM "event_sources" source
JOIN "events" event ON event."id" = source."event_id";
