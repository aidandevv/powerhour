CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"ip" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_audit_log_created_at" ON "audit_log" ("created_at");
--> statement-breakpoint
CREATE INDEX "idx_audit_log_action" ON "audit_log" ("action");
--> statement-breakpoint
CREATE TABLE "digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_from" date NOT NULL,
	"period_to" date NOT NULL,
	"summary_markdown" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
