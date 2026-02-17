CREATE TABLE "expense_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"budget_plan_id" uuid REFERENCES "public"."budget_plans"("id") ON DELETE set null,
	"date_from" date,
	"date_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL REFERENCES "public"."expense_groups"("id") ON DELETE cascade,
	"transaction_id" uuid NOT NULL REFERENCES "public"."transactions"("id") ON DELETE cascade,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_group_members_group_id_transaction_id_unique" UNIQUE("group_id","transaction_id")
);
--> statement-breakpoint
CREATE INDEX "idx_expense_group_members_group_id" ON "expense_group_members" USING btree ("group_id");
--> statement-breakpoint
CREATE INDEX "idx_expense_group_members_transaction_id" ON "expense_group_members" USING btree ("transaction_id");
