CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"fields" jsonb NOT NULL,
	"model" text,
	"reply_email" text,
	"app_version" text,
	"app_build" text,
	"macos_version" text,
	"mac_model" text,
	"profile_name" text,
	"locale" text,
	"diagnostics" text,
	"client_uuid" text,
	"ip_hash" text,
	"status" text DEFAULT 'new' NOT NULL,
	"discord_sent" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"key_hash" text NOT NULL,
	"kind" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rate_events_key_hash_created_at_idx" ON "rate_events" USING btree ("key_hash","created_at");