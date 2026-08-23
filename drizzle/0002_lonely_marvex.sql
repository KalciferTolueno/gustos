ALTER TABLE "users" ADD COLUMN "credential_email" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_credential_email_unique" UNIQUE("credential_email");