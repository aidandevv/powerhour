import { NextRequest, NextResponse } from "next/server";
import { gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { balanceSnapshots, accounts } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  try {
    const days = parseInt(req.nextUrl.searchParams.get("days") || "365", 10);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    const fromDateStr = fromDate.toISOString().split("T")[0];

    const result = await db
      .select({
        date: balanceSnapshots.snapshotDate,
        assets: sql<string>`sum(CASE WHEN ${accounts.type} NOT IN ('credit', 'loan') THEN coalesce(${balanceSnapshots.currentBalance}, 0) ELSE 0 END)`,
        liabilities: sql<string>`sum(CASE WHEN ${accounts.type} IN ('credit', 'loan') THEN abs(coalesce(${balanceSnapshots.currentBalance}, 0)) ELSE 0 END)`,
      })
      .from(balanceSnapshots)
      .innerJoin(accounts, sql`${balanceSnapshots.accountId} = ${accounts.id}`)
      .where(gte(balanceSnapshots.snapshotDate, fromDateStr))
      .groupBy(balanceSnapshots.snapshotDate)
      .orderBy(balanceSnapshots.snapshotDate);

    const history = result.map((r) => ({
      date: r.date,
      assets: parseFloat(r.assets || "0"),
      liabilities: parseFloat(r.liabilities || "0"),
    }));

    return NextResponse.json({ history });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch asset/liability history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
