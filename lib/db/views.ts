/**
 * Agent-facing database views.
 *
 * These views expose only non-sensitive columns to AI agent tool functions.
 * The base `institutions` table contains `plaid_access_token` (AES-256-GCM
 * encrypted) and `sync_cursor` — these MUST NOT appear in any agent query
 * result. The views enforce that exclusion at the database layer.
 *
 * Views are created via custom SQL migration (0000_agent_views.sql) because
 * drizzle-kit cannot create views via db:push. These definitions use
 * .existing() for type inference only.
 */
import { pgView } from "drizzle-orm/pg-core";
import { text, uuid, numeric, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Safe accounts view — joins accounts + institutions, excluding sensitive
 * fields (plaid_access_token, sync_cursor, error_code, plaid_item_id).
 * Agent tool functions should query this view instead of the base tables.
 */
export const agentAccountsView = pgView("agent_accounts_view", {
  id: uuid("id"),
  name: text("name"),
  officialName: text("official_name"),
  type: text("type"),
  subtype: text("subtype"),
  currencyCode: text("currency_code"),
  currentBalance: numeric("current_balance", { precision: 14, scale: 2 }),
  availableBalance: numeric("available_balance", { precision: 14, scale: 2 }),
  creditLimit: numeric("credit_limit", { precision: 14, scale: 2 }),
  isActive: boolean("is_active"),
  institutionId: uuid("institution_id"),
  institutionName: text("institution_name"),
  institutionStatus: text("institution_status"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
}).existing();

/** Safe institutions view — exposes name and sync status only. */
export const agentInstitutionsView = pgView("agent_institutions_view", {
  id: uuid("id"),
  institutionName: text("institution_name"),
  status: text("status"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
}).existing();
