/** Recurring expenses listing with normalised monthly totals. */
import { db } from "@/lib/db";
import { recurringItems, accounts } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export interface RecurringExpenseRow {
  id: string;
  name: string;
  merchantName: string | null;
  amount: number;
  frequency: string;
  lastDate: string | null;
  nextProjectedDate: string | null;
  accountName: string;
  isUserConfirmed: boolean;
}

export interface RecurringExpensesResult {
  items: RecurringExpenseRow[];
  totalMonthlyEstimate: number; // Normalized to monthly frequency
}

function toMonthlyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case "weekly":     return amount * 52 / 12;
    case "biweekly":   return amount * 26 / 12;
    case "monthly":    return amount;
    case "annually":   return amount / 12;
    default:           return amount;
  }
}

export async function getRecurringExpenses(): Promise<RecurringExpensesResult> {
  const rows = await db
    .select({
      id: recurringItems.id,
      name: recurringItems.name,
      merchantName: recurringItems.merchantName,
      amount: recurringItems.amount,
      frequency: recurringItems.frequency,
      lastDate: recurringItems.lastDate,
      nextProjectedDate: recurringItems.nextProjectedDate,
      isUserConfirmed: recurringItems.isUserConfirmed,
      accountName: accounts.name,
    })
    .from(recurringItems)
    .innerJoin(accounts, eq(recurringItems.accountId, accounts.id))
    .where(eq(recurringItems.isActive, true))
    .orderBy(asc(recurringItems.name));

  const items: RecurringExpenseRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    merchantName: r.merchantName ?? null,
    amount: parseFloat(String(r.amount)),
    frequency: r.frequency,
    lastDate: r.lastDate ?? null,
    nextProjectedDate: r.nextProjectedDate ?? null,
    accountName: r.accountName,
    isUserConfirmed: r.isUserConfirmed,
  }));

  const totalMonthlyEstimate = items.reduce(
    (sum, item) => sum + toMonthlyAmount(item.amount, item.frequency),
    0
  );

  return { items, totalMonthlyEstimate };
}
