/**
 * Account balances across all linked institutions.
 * Queries agentAccountsView which excludes sensitive fields
 * (access tokens, sync cursors, error codes).
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
  try {
    const rows = await db
      .select()
      .from(agentAccountsView);

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
  } catch (error) {
    console.error("[account-balances] Error fetching balances:", error);
    throw new Error(
      `Failed to fetch account balances: ${error instanceof Error ? error.message : "Unknown error"}. ` +
      `This might be because the database view 'agent_accounts_view' doesn't exist. ` +
      `Run 'npm run db:migrate' to create it.`
    );
  }
}
