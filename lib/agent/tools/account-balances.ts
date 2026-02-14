/**
 * TOOL-02: Account balances across all institutions
 *
 * SEC-02: Read-only — queries agentAccountsView (a PostgreSQL VIEW, which is
 *         inherently read-only — no INSERT/UPDATE/DELETE possible against a view
 *         without an INSTEAD OF trigger, which we have not defined)
 * SEC-03: agentAccountsView excludes plaid_access_token, sync_cursor, error_code
 *         from the institutions table. Safe to return in agent results.
 */
import { db } from "@/lib/db";
import { agentAccountsView } from "@/lib/db/views";
import { eq } from "drizzle-orm";

export interface AccountRow {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
  currentBalance: number | null;
  availableBalance: number | null;
  creditLimit: number | null;
  currencyCode: string;
  institutionName: string;
}

export interface AccountBalancesResult {
  accounts: AccountRow[];
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

export async function getAccountBalances(): Promise<AccountBalancesResult> {
  const rows = await db
    .select()
    .from(agentAccountsView)
    .where(eq(agentAccountsView.isActive, true));

  let totalAssets = 0;
  let totalLiabilities = 0;

  const accounts: AccountRow[] = rows.map((r) => {
    const balance = parseFloat(String(r.currentBalance ?? "0"));
    // Credit and loan accounts: balance is what's owed (liability)
    if (r.type === "credit" || r.type === "loan") {
      totalLiabilities += Math.abs(balance);
    } else {
      // Depository, investment, etc: balance is an asset
      totalAssets += balance;
    }

    return {
      id: r.id!,
      name: r.name!,
      type: r.type!,
      subtype: r.subtype ?? null,
      currentBalance: r.currentBalance !== null
        ? parseFloat(String(r.currentBalance))
        : null,
      availableBalance: r.availableBalance !== null
        ? parseFloat(String(r.availableBalance))
        : null,
      creditLimit: r.creditLimit !== null
        ? parseFloat(String(r.creditLimit))
        : null,
      currencyCode: r.currencyCode ?? "USD",
      institutionName: r.institutionName!,
    };
  });

  return {
    accounts,
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
  };
}
