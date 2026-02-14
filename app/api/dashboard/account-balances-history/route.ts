import { NextRequest, NextResponse } from "next/server";
import { gte, eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { balanceSnapshots, accounts } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  try {
    const days = parseInt(req.nextUrl.searchParams.get("days") || "90", 10);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    const fromDateStr = fromDate.toISOString().split("T")[0];

    const rows = await db
      .select({
        accountId: balanceSnapshots.accountId,
        accountName: accounts.name,
        accountType: accounts.type,
        date: balanceSnapshots.snapshotDate,
        balance: balanceSnapshots.currentBalance,
      })
      .from(balanceSnapshots)
      .innerJoin(accounts, eq(balanceSnapshots.accountId, accounts.id))
      .where(
        and(
          gte(balanceSnapshots.snapshotDate, fromDateStr),
          eq(accounts.isActive, true)
        )
      )
      .orderBy(balanceSnapshots.snapshotDate);

    // Group by account
    const accountMap = new Map<string, { id: string; name: string; type: string; snapshots: { date: string; balance: number }[] }>();
    for (const row of rows) {
      if (!accountMap.has(row.accountId)) {
        accountMap.set(row.accountId, {
          id: row.accountId,
          name: row.accountName,
          type: row.accountType,
          snapshots: [],
        });
      }
      accountMap.get(row.accountId)!.snapshots.push({
        date: row.date,
        balance: parseFloat(row.balance ?? "0"),
      });
    }

    // Only return accounts that have snapshot data
    const accountsWithData = Array.from(accountMap.values()).filter(
      (a) => a.snapshots.length > 0
    );

    return NextResponse.json({ accounts: accountsWithData });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch account balance history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
