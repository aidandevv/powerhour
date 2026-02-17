CREATE TABLE "budget_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"category_label" text NOT NULL,
	"target_type" text NOT NULL,
	"monthly_target" numeric(14, 2) NOT NULL,
	"baseline_monthly_spend" numeric(14, 2) NOT NULL,
	"rationale" text NOT NULL,
	"status" text DEFAULT 'suggested' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
