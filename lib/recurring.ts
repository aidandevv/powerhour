import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, recurringItems, accounts } from "@/lib/db/schema";

interface TransactionGroup {
  merchantName: string;
  amounts: number[];
  dates: Date[];
  accountId: string;
}

function normalizeMerchantName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function calculateFrequency(
  dates: Date[]
): { frequency: string; intervalDays: number } | null {
  if (dates.length < 3) return null;

  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const intervals: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.round(
      (sorted[i].getTime() - sorted[i - 1].getTime()) / (1000 * 60 * 60 * 24)
    );
    intervals.push(diff);
  }

  const avgInterval =
    intervals.reduce((sum, v) => sum + v, 0) / intervals.length;

  // Check consistency: all intervals within tolerance
  if (avgInterval <= 10) {
    // Weekly: avg ~7 days, tolerance ±1 day
    const allConsistent = intervals.every((d) => Math.abs(d - 7) <= 1);
    if (allConsistent) return { frequency: "weekly", intervalDays: 7 };
  } else if (avgInterval <= 18) {
    // Biweekly: avg ~14 days, tolerance ±2 days
    const allConsistent = intervals.every((d) => Math.abs(d - 14) <= 2);
    if (allConsistent) return { frequency: "biweekly", intervalDays: 14 };
  } else if (avgInterval <= 45) {
    // Monthly: avg ~30 days, tolerance ±3 days
    const allConsistent = intervals.every((d) => Math.abs(d - 30) <= 3);
    if (allConsistent) return { frequency: "monthly", intervalDays: 30 };
  } else if (avgInterval >= 350 && avgInterval <= 380) {
    // Annually
    const allConsistent = intervals.every(
      (d) => Math.abs(d - 365) <= 10
    );
    if (allConsistent) return { frequency: "annually", intervalDays: 365 };
  }

  return null;
}

function amountsAreConsistent(amounts: number[]): boolean {
  if (amounts.length < 2) return false;
  const avg = amounts.reduce((sum, v) => sum + v, 0) / amounts.length;
  if (avg === 0) return false;
  return amounts.every((a) => Math.abs(a - avg) / Math.abs(avg) <= 0.05);
}

export async function detectRecurringTransactions(accountId: string) {
  const allTxns = await db
    .select({
      name: transactions.name,
      merchantName: transactions.merchantName,
      amount: transactions.amount,
      date: transactions.date,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, accountId),
        eq(transactions.pending, false)
      )
    )
    .orderBy(desc(transactions.date));

  // Group by normalized merchant name
  const groups: Record<string, TransactionGroup> = {};

  for (const txn of allTxns) {
    const key = normalizeMerchantName(txn.merchantName || txn.name);
    if (!groups[key]) {
      groups[key] = {
        merchantName: txn.merchantName || txn.name,
        amounts: [],
        dates: [],
        accountId,
      };
    }
    groups[key].amounts.push(parseFloat(txn.amount));
    groups[key].dates.push(new Date(txn.date));
  }

  // Detect recurring patterns
  for (const [, group] of Object.entries(groups)) {
    if (group.amounts.length < 3) continue;
    if (!amountsAreConsistent(group.amounts)) continue;

    const freq = calculateFrequency(group.dates);
    if (!freq) continue;

    const avgAmount =
      group.amounts.reduce((s, v) => s + v, 0) / group.amounts.length;
    const sortedDates = [...group.dates].sort(
      (a, b) => b.getTime() - a.getTime()
    );
    const lastDate = sortedDates[0];
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + freq.intervalDays);

    // Upsert recurring item
    const existing = await db
      .select()
      .from(recurringItems)
      .where(
        and(
          eq(recurringItems.accountId, accountId),
          eq(recurringItems.merchantName, group.merchantName)
        )
      );

    if (existing.length > 0) {
      await db
        .update(recurringItems)
        .set({
          amount: avgAmount.toFixed(2),
          frequency: freq.frequency,
          lastDate: lastDate.toISOString().split("T")[0],
          nextProjectedDate: nextDate.toISOString().split("T")[0],
          updatedAt: new Date(),
        })
        .where(eq(recurringItems.id, existing[0].id));
    } else {
      await db.insert(recurringItems).values({
        accountId,
        name: group.merchantName,
        merchantName: group.merchantName,
        amount: avgAmount.toFixed(2),
        frequency: freq.frequency,
        lastDate: lastDate.toISOString().split("T")[0],
        nextProjectedDate: nextDate.toISOString().split("T")[0],
      });
    }
  }
}

export async function detectAllRecurring() {
  const allAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.isActive, true));

  for (const account of allAccounts) {
    await detectRecurringTransactions(account.id);
  }
}
