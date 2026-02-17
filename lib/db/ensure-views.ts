/**
 * Ensures agent database views exist.
 * Called automatically on app startup via instrumentation.ts.
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

export async function ensureAgentViews(): Promise<void> {
  try {
    // Check if views exist by querying information_schema
    const result = await db.execute<{ table_name: string }>(sql`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
      AND table_name IN ('agent_accounts_view', 'agent_institutions_view')
    `);

    if (result.length === 2) {
      console.log("[db] Agent views verified");
      return;
    }

    console.log("[db] Creating agent views...");

    // Create agent_accounts_view
    await db.execute(sql`
      CREATE OR REPLACE VIEW agent_accounts_view AS
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
      WHERE a.is_active = true
    `);

    // Create agent_institutions_view
    await db.execute(sql`
      CREATE OR REPLACE VIEW agent_institutions_view AS
      SELECT
        id,
        institution_name,
        status,
        last_synced_at
      FROM institutions
    `);

    console.log("[db] Agent views created successfully");
  } catch (err) {
    // Log but don't throw - the app should still start even if view creation fails
    console.error(
      "[db] Failed to create agent views:",
      err instanceof Error ? err.message : err
    );
  }
}
