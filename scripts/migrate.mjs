#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const migrationsDir = path.join(root, "lib", "db", "migrations");
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

function resolveSslMode() {
  const configured = process.env.DATABASE_SSL?.toLowerCase();
  if (configured === "false" || configured === "disable" || configured === "disabled") {
    return false;
  }
  if (configured === "true" || configured === "require" || configured === "required") {
    return "require";
  }

  const usesComposeDb = /\/\/[^/@]*@?db(?::|\/)/.test(databaseUrl);
  return process.env.NODE_ENV === "production" && !usesComposeDb ? "require" : false;
}

function splitStatements(sqlText) {
  return sqlText
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

const bootstrapStatements = [
  `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
  `CREATE TABLE IF NOT EXISTS "institutions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "plaid_item_id" text NOT NULL UNIQUE,
    "plaid_access_token" text NOT NULL,
    "institution_name" text NOT NULL,
    "institution_id" text NOT NULL,
    "sync_cursor" text,
    "last_synced_at" timestamp with time zone,
    "status" text DEFAULT 'active' NOT NULL,
    "error_code" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "accounts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "institution_id" uuid NOT NULL REFERENCES "public"."institutions"("id") ON DELETE cascade,
    "plaid_account_id" text NOT NULL UNIQUE,
    "name" text NOT NULL,
    "official_name" text,
    "type" text NOT NULL,
    "subtype" text,
    "currency_code" text DEFAULT 'USD' NOT NULL,
    "current_balance" numeric(14, 2),
    "available_balance" numeric(14, 2),
    "credit_limit" numeric(14, 2),
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "transactions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "account_id" uuid NOT NULL REFERENCES "public"."accounts"("id") ON DELETE cascade,
    "plaid_transaction_id" text NOT NULL UNIQUE,
    "amount" numeric(14, 2) NOT NULL,
    "currency_code" text DEFAULT 'USD' NOT NULL,
    "date" date NOT NULL,
    "name" text NOT NULL,
    "merchant_name" text,
    "category" text,
    "category_detailed" text,
    "pending" boolean DEFAULT false NOT NULL,
    "payment_channel" text,
    "logo_url" text,
    "website" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "idx_transactions_account_id" ON "transactions" USING btree ("account_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_transactions_date" ON "transactions" USING btree ("date")`,
  `CREATE INDEX IF NOT EXISTS "idx_transactions_pending" ON "transactions" USING btree ("pending")`,
  `CREATE TABLE IF NOT EXISTS "balance_snapshots" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "account_id" uuid NOT NULL REFERENCES "public"."accounts"("id") ON DELETE cascade,
    "snapshot_date" date NOT NULL,
    "current_balance" numeric(14, 2),
    "available_balance" numeric(14, 2),
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE ("account_id", "snapshot_date")
  )`,
  `CREATE INDEX IF NOT EXISTS "idx_balance_snapshots_date" ON "balance_snapshots" USING btree ("snapshot_date")`,
  `CREATE INDEX IF NOT EXISTS "idx_balance_snapshots_account" ON "balance_snapshots" USING btree ("account_id", "snapshot_date")`,
  `CREATE TABLE IF NOT EXISTS "recurring_items" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "account_id" uuid NOT NULL REFERENCES "public"."accounts"("id") ON DELETE cascade,
    "name" text NOT NULL,
    "merchant_name" text,
    "amount" numeric(14, 2) NOT NULL,
    "frequency" text NOT NULL,
    "last_date" date,
    "next_projected_date" date,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_user_confirmed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "budget_plans" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "title" text NOT NULL,
    "summary_text" text,
    "messages_json" jsonb NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "expense_groups" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "budget_plan_id" uuid REFERENCES "public"."budget_plans"("id") ON DELETE set null,
    "date_from" date,
    "date_to" date,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "expense_group_members" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "group_id" uuid NOT NULL REFERENCES "public"."expense_groups"("id") ON DELETE cascade,
    "transaction_id" uuid NOT NULL REFERENCES "public"."transactions"("id") ON DELETE cascade,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE ("group_id", "transaction_id")
  )`,
  `CREATE INDEX IF NOT EXISTS "idx_expense_group_members_group_id" ON "expense_group_members" USING btree ("group_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_expense_group_members_transaction_id" ON "expense_group_members" USING btree ("transaction_id")`,
  `CREATE TABLE IF NOT EXISTS "savings_targets" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "target_amount" numeric(14, 2) NOT NULL,
    "target_date" date NOT NULL,
    "monthly_amount" numeric(14, 2) NOT NULL,
    "budget_plan_id" uuid,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "user_settings" (
    "id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
    "password_hash" text,
    "sync_schedule_enabled" boolean DEFAULT true NOT NULL,
    "digest_schedule_enabled" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "sync_schedule_enabled" boolean DEFAULT true NOT NULL`,
  `ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "digest_schedule_enabled" boolean DEFAULT true NOT NULL`,
  `CREATE TABLE IF NOT EXISTS "audit_log" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "action" text NOT NULL,
    "ip" text,
    "metadata" jsonb,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "idx_audit_log_created_at" ON "audit_log" USING btree ("created_at")`,
  `CREATE INDEX IF NOT EXISTS "idx_audit_log_action" ON "audit_log" USING btree ("action")`,
  `CREATE TABLE IF NOT EXISTS "digests" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "period_from" date NOT NULL,
    "period_to" date NOT NULL,
    "summary_markdown" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "budget_goals" (
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
  )`,
  `CREATE OR REPLACE VIEW agent_accounts_view AS
    SELECT
      a.id,
      a.name,
      a.official_name,
      a.type,
      a.subtype,
      a.currency_code,
      a.current_balance,
      a.available_balance,
      a.credit_limit,
      a.is_active,
      a.institution_id,
      i.institution_name,
      i.status AS institution_status,
      i.last_synced_at
    FROM accounts a
    INNER JOIN institutions i ON a.institution_id = i.id
    WHERE a.is_active = true`,
  `CREATE OR REPLACE VIEW agent_institutions_view AS
    SELECT
      id,
      institution_name,
      status,
      last_synced_at
    FROM institutions`,
];

const sql = postgres(databaseUrl, {
  max: 1,
  ssl: resolveSslMode(),
});

try {
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  await sql`
    CREATE TABLE IF NOT EXISTS powerhour_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const baseTables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'institutions'
  `;

  const appliedRows = await sql`SELECT id FROM powerhour_migrations`;
  const applied = new Set(appliedRows.map((row) => row.id));

  if (baseTables.length === 0 || applied.size === 0) {
    await sql.begin(async (tx) => {
      for (const statement of bootstrapStatements) {
        await tx.unsafe(statement);
      }
      for (const file of files) {
        await tx`
          INSERT INTO powerhour_migrations (id)
          VALUES (${file})
          ON CONFLICT (id) DO NOTHING
        `;
      }
    });

    console.log("[migrate] current schema verified");
    for (const file of files) {
      applied.add(file);
    }
  }

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`[migrate] ${file} already applied`);
      continue;
    }

    const sqlText = await fs.readFile(path.join(migrationsDir, file), "utf8");
    const statements = splitStatements(sqlText);

    await sql.begin(async (tx) => {
      for (const statement of statements) {
        await tx.unsafe(statement);
      }
      await tx`INSERT INTO powerhour_migrations (id) VALUES (${file})`;
    });

    console.log(`[migrate] applied ${file}`);
  }

  console.log("[migrate] database is up to date");
} finally {
  await sql.end({ timeout: 5 });
}
