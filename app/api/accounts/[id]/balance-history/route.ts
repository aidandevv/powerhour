import { NextRequest, NextResponse } from "next/server";
import { eq, desc, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { balanceSnapshots } from "@/lib/db/schema";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const days = parseInt(searchParams.get("days") || "90", 10);

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    const fromDateStr = fromDate.toISOString().split("T")[0];

    const snapshots = await db
      .select({
        date: balanceSnapshots.snapshotDate,
        balance: balanceSnapshots.currentBalance,
        available: balanceSnapshots.availableBalance,
      })
      .from(balanceSnapshots)
      .where(
        eq(balanceSnapshots.accountId, params.id),
      )
      .orderBy(desc(balanceSnapshots.snapshotDate));

    // Filter by date in application code since date comparison with string
    const filtered = snapshots.filter((s) => s.date >= fromDateStr);

    return NextResponse.json({ snapshots: filtered.reverse() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch balance history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
