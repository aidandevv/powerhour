/**
 * TOOL-03: Transaction search by merchant name, keyword, or date range
 *
 * SEC-02: Drizzle .select() — generates SELECT only
 * SEC-03: Joins only accounts, never institutions table
 * SEC-06: transactionSearchSchema validates all inputs (Zod) before DB query
 *
 * NOTE: transactionSearchSchema is also used as inputSchema in the Phase 2
 * AI SDK tool() wrapper. Export it explicitly for reuse.
 */
import { db } from "@/lib/db";
import { transactions, accounts } from "@/lib/db/schema";
import { and, gte, lte, ilike, desc, eq, or } from "drizzle-orm";
import { z } from "zod";

export const transactionSearchSchema = z.object({
  query: z.string().min(1).max(100).describe("Merchant name or keyword to search"),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .optional()
    .describe("Start date in YYYY-MM-DD format"),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .optional()
    .describe("End date in YYYY-MM-DD format"),
  limit: z.number().int().min(1).max(50).default(20),
});

export type TransactionSearchParams = z.infer<typeof transactionSearchSchema>;

export interface TransactionSearchRow {
  id: string;
  date: string;
  name: string;
  merchantName: string | null;
  amount: number;
  category: string | null;
  accountName: string;
}

export async function searchTransactions(
  params: TransactionSearchParams
): Promise<TransactionSearchRow[]> {
  // Validate params with Zod (SEC-06: sanitize before query)
  const validated = transactionSearchSchema.parse(params);
  const { query, from, to, limit } = validated;

  const conditions = [
    or(
      ilike(transactions.name, `%${query}%`),
      ilike(transactions.merchantName, `%${query}%`)
    )!,
  ];

  if (from) conditions.push(gte(transactions.date, from));
  if (to) conditions.push(lte(transactions.date, to));

  const rows = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      name: transactions.name,
      merchantName: transactions.merchantName,
      amount: transactions.amount,
      category: transactions.category,
      accountName: accounts.name,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(...conditions))
    .orderBy(desc(transactions.date))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    name: r.name,
    merchantName: r.merchantName ?? null,
    amount: parseFloat(String(r.amount)),
    category: r.category ?? null,
    accountName: r.accountName,
  }));
}
