CREATE TABLE IF NOT EXISTS "user_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"password_hash" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
