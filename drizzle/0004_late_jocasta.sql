CREATE TABLE "search_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"query_id" integer,
	"user_id" text,
	"requester_hash" text NOT NULL,
	"cache_hit" boolean DEFAULT false NOT NULL,
	"searches" integer DEFAULT 0 NOT NULL,
	"result_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'succeeded' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "input_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "output_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "estimated_cost_micros" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "discovery_queries" ADD COLUMN "category_slug" text;--> statement-breakpoint
ALTER TABLE "discovery_queries" ADD COLUMN "region" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "category_id" integer;--> statement-breakpoint
ALTER TABLE "search_requests" ADD CONSTRAINT "search_requests_query_id_discovery_queries_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."discovery_queries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_requests" ADD CONSTRAINT "search_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_requests_created_idx" ON "search_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "search_requests_query_idx" ON "search_requests" USING btree ("query_id");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_category_id_topics_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_parent_id_topics_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_topics_topic_idx" ON "event_topics" USING btree ("topic_id","event_id");--> statement-breakpoint
CREATE INDEX "events_category_idx" ON "events" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "topics_parent_idx" ON "topics" USING btree ("parent_id");
