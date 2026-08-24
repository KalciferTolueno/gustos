ALTER TABLE "events" ADD COLUMN "time_precision" text DEFAULT 'exact' NOT NULL;
--> statement-breakpoint
UPDATE "events"
SET
  "time_precision" = 'date',
  "starts_at" = ((("starts_at" AT TIME ZONE 'UTC')::date + TIME '12:00') AT TIME ZONE 'UTC'),
  "ends_at" = CASE
    WHEN "ends_at" IS NULL THEN NULL
    ELSE ((("ends_at" AT TIME ZONE 'America/Santiago')::date + TIME '12:00') AT TIME ZONE 'UTC')
  END
WHERE EXTRACT(HOUR FROM "starts_at" AT TIME ZONE 'America/Santiago') = 0
  AND EXTRACT(MINUTE FROM "starts_at" AT TIME ZONE 'America/Santiago') = 0;
