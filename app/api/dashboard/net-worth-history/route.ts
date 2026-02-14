import { NextRequest, NextResponse } from "next/server";
import { gte, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { balanceSnapshots, accounts } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  try {
    const days = parseInt(req.nextUrl.searchParams.get("days") || "365", 10);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    const fromDateStr = fromDate.toISOString().split("T")[0];

    // Get daily net worth by summing all account snapshots per day
    // Assets (depository, investment) are positive, liabilities (credit, loan) are subtracted
    const result = await db
      .select({
        date: balanceSnapshots.snapshotDate,
        netWorth: sql<string>`sum(
          CASE
            WHEN ${accounts.type} IN ('credit', 'loan') THEN -abs(${balanceSnapshots.currentBalance})
            ELSE ${balanceSnapshots.currentBalance}
          END
        )`,
      })
      .from(balanceSnapshots)
      .innerJoin(accounts, sql`${balanceSnapshots.accountId} = ${accounts.id}`)
      .where(gte(balanceSnapshots.snapshotDate, fromDateStr))
      .groupBy(balanceSnapshots.snapshotDate)
      .orderBy(balanceSnapshots.snapshotDate);

    const history = result.map((r) => ({
      date: r.date,
      netWorth: parseFloat(r.netWorth || "0"),
    }));

    return NextResponse.json({ history });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch net worth history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
