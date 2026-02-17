import { NextRequest, NextResponse } from "next/server";
import { gte, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { balanceSnapshots, accounts } from "@/lib/db/schema";
import { apiError } from "@/lib/api/error";

export async function GET(req: NextRequest) {
  try {
    const days = Math.min(parseInt(req.nextUrl.searchParams.get("days") || "365", 10), 730);
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
    return apiError(error, "Failed to fetch net worth history");
  }
}
