/**
 * Credit utilization tool — shows how much of each credit card limit is being used.
 * Use when user asks "what's my credit utilization?", "how much credit am I using?", "credit card balances", etc.
 */
import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";

export interface CreditUtilizationCard {
  id: string;
  name: string;
  balance: number;
  limit: number;
  utilization: number; // percentage (0-100)
  available: number;
}

export interface CreditUtilizationResult {
  cards: CreditUtilizationCard[];
  summary: string;
  totalBalance: number;
  totalLimit: number;
  overallUtilization: number;
}

export async function getCreditUtilization(): Promise<CreditUtilizationResult> {
  const rows = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      currentBalance: accounts.currentBalance,
      creditLimit: accounts.creditLimit,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.isActive, true),
        eq(accounts.type, "credit"),
        isNotNull(accounts.creditLimit)
      )
    );

  const cards: CreditUtilizationCard[] = rows
    .filter((r) => parseFloat(r.creditLimit ?? "0") > 0)
    .map((r) => {
      const balance = parseFloat(r.currentBalance ?? "0");
      const limit = parseFloat(r.creditLimit ?? "0");
      const utilization = limit > 0 ? Math.round((balance / limit) * 100) : 0;
      return {
        id: r.id,
        name: r.name,
        balance,
        limit,
        utilization,
        available: limit - balance,
      };
    })
    .sort((a, b) => b.utilization - a.utilization);

  const totalBalance = cards.reduce((sum, c) => sum + c.balance, 0);
  const totalLimit = cards.reduce((sum, c) => sum + c.limit, 0);
  const overallUtilization = totalLimit > 0 ? Math.round((totalBalance / totalLimit) * 100) : 0;

  let summary = "";
  if (cards.length === 0) {
    summary = "No active credit cards found.";
  } else {
    summary = `You have ${cards.length} credit card${cards.length > 1 ? "s" : ""} with ${overallUtilization}% overall utilization ($${totalBalance.toFixed(0)} used of $${totalLimit.toFixed(0)} total limit).`;

    const highUtil = cards.filter((c) => c.utilization >= 70);
    if (highUtil.length > 0) {
      summary += ` **${highUtil.length} card${highUtil.length > 1 ? "s have" : " has"} high utilization (≥70%)** — consider paying down balances to improve credit score.`;
    }
  }

  return {
    cards,
    summary,
    totalBalance,
    totalLimit,
    overallUtilization,
  };
}
