/**
 * Suggest transactions for expense grouping by date range and optional keyword.
 * Reuses logic from /api/expense-groups/suggest.
 * Use when user asks "group my Japan trip expenses", "what did I spend on my March vacation",
 * or "find transactions for my NYC trip".
 */
import { and, eq, gte, lte, ilike, or, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, accounts } from "@/lib/db/schema";
import { z } from "zod";

export const suggestTransactionsForGroupSchema = z.object({
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Start date (YYYY-MM-DD) for the trip/period"),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("End date (YYYY-MM-DD) for the trip/period"),
  query: z
    .string()
    .max(100)
    .optional()
    .describe("Optional keyword (e.g. Japan, Airbnb, hotel) to filter matches"),
  limit: z.number().int().min(1).max(100).default(50),
});

export interface SuggestTransactionsForGroupRow {
  id: string;
  date: string;
  name: string;
  merchantName: string | null;
  amount: number;
  category: string | null;
}

export interface SuggestTransactionsForGroupResult {
  suggestions: SuggestTransactionsForGroupRow[];
  totalAmount: number;
}

export async function suggestTransactionsForGroup(params: {
  dateFrom: string;
  dateTo: string;
  query?: string;
  limit?: number;
}): Promise<SuggestTransactionsForGroupResult> {
  const { dateFrom, dateTo, query, limit = 50 } =
    suggestTransactionsForGroupSchema.parse(params);

  const conditions = [
    gte(transactions.date, dateFrom),
    lte(transactions.date, dateTo),
  ];

  if (query && query.trim()) {
    const q = `%${query.trim()}%`;
    conditions.push(
      or(
        ilike(transactions.name, q),
        ilike(transactions.merchantName, q),
        ilike(transactions.category ?? "", q)
      )!
    );
  }

  const rows = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      name: transactions.name,
      merchantName: transactions.merchantName,
      amount: transactions.amount,
      category: transactions.category,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(...conditions))
    .orderBy(desc(transactions.date))
    .limit(limit);

  const suggestions = rows.map((r) => ({
    id: r.id,
    date: r.date,
    name: r.name,
    merchantName: r.merchantName ?? null,
    amount: parseFloat(String(r.amount)),
    category: r.category ?? null,
  }));

  const totalAmount = suggestions.reduce((sum, s) => sum + s.amount, 0);

  return { suggestions, totalAmount };
}
