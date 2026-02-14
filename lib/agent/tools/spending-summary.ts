/**
 * TOOL-01: Spending summary by category for a date range
 *
 * SEC-02: Read-only — uses Drizzle .select() which generates SELECT SQL only
 * SEC-03: Does not touch institutions table — no plaid_access_token exposure
 * SEC-06: Input validated by TypeScript types (AI SDK will add Zod in Phase 2)
 */
import { db } from "@/lib/db";
import { transactions, accounts } from "@/lib/db/schema";
import { and, gte, lte, gt, sql, eq } from "drizzle-orm";

export interface SpendingSummaryParams {
  from: string;   // ISO date "YYYY-MM-DD"
  to: string;     // ISO date "YYYY-MM-DD"
  category?: string; // Optional filter to a specific category
}

export interface SpendingSummaryRow {
  category: string;
  amount: number;
  count: number;
}

export interface SpendingSummaryResult {
  summary: SpendingSummaryRow[];
  from: string;
  to: string;
  totalSpend: number;
}

export async function getSpendingSummary(
  params: SpendingSummaryParams
): Promise<SpendingSummaryResult> {
  const { from, to, category } = params;

  const conditions = [
    gte(transactions.date, from),
    lte(transactions.date, to),
    // Only include debits (positive amount = money out in Plaid convention)
    gt(transactions.amount, "0"),
    // Exclude pending transactions for accuracy
    eq(transactions.pending, false),
  ];

  if (category) {
    conditions.push(eq(transactions.category, category));
  }

  const rows = await db
    .select({
      category: transactions.category,
      total: sql<string>`sum(${transactions.amount})`,
      count: sql<number>`count(*)::int`,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(...conditions))
    .groupBy(transactions.category)
    .orderBy(sql`sum(${transactions.amount}) desc`);

  const summary: SpendingSummaryRow[] = rows.map((r) => ({
    category: r.category ?? "Uncategorized",
    amount: parseFloat(r.total ?? "0"),
    count: r.count,
  }));

  return {
    summary,
    from,
    to,
    totalSpend: summary.reduce((sum, r) => sum + r.amount, 0),
  };
}
