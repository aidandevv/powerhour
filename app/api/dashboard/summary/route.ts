import { NextResponse } from "next/server";
import { eq, and, gte, lte, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, institutions, transactions } from "@/lib/db/schema";
import { apiError } from "@/lib/api/error";

export async function GET() {
  try {
    // Get all active accounts with institution info
    const allAccounts = await db
      .select({
        id: accounts.id,
        name: accounts.name,
        type: accounts.type,
        subtype: accounts.subtype,
        currentBalance: accounts.currentBalance,
        availableBalance: accounts.availableBalance,
        institutionName: institutions.institutionName,
      })
      .from(accounts)
      .innerJoin(institutions, eq(accounts.institutionId, institutions.id))
      .where(eq(accounts.isActive, true));

    // Calculate net worth
    let totalAssets = 0;
    let totalLiabilities = 0;

    for (const acct of allAccounts) {
      const balance = parseFloat(acct.currentBalance || "0");
      if (acct.type === "credit" || acct.type === "loan") {
        totalLiabilities += Math.abs(balance);
      } else {
        totalAssets += balance;
      }
    }

    const netWorth = totalAssets - totalLiabilities;

    // Month-to-date spending
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const today = now.toISOString().split("T")[0];

    const [spendingResult] = await db
      .select({
        total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          gte(transactions.date, monthStart),
          lte(transactions.date, today),
          gt(transactions.amount, "0")
        )
      );

    const monthToDateSpending = parseFloat(spendingResult?.total || "0");

    return NextResponse.json({
      netWorth,
      totalAssets,
      totalLiabilities,
      monthToDateSpending,
      accounts: allAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        subtype: a.subtype,
        currentBalance: parseFloat(a.currentBalance || "0"),
        availableBalance: a.availableBalance
          ? parseFloat(a.availableBalance)
          : null,
        institutionName: a.institutionName,
      })),
    });
  } catch (error: unknown) {
    return apiError(error, "Failed to fetch dashboard summary");
  }
}
