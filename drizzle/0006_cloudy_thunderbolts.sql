ALTER TABLE "events" ADD COLUMN "catalog_audit_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "catalog_audited_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "events_catalog_audit_idx" ON "events" USING btree ("catalog_audit_version","starts_at");