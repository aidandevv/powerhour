import { NextRequest, NextResponse } from "next/server";
import { sql, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  try {
    const months = parseInt(req.nextUrl.searchParams.get("months") || "6", 10);

    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - months);
    const fromDateStr = fromDate.toISOString().split("T")[0];

    const result = await db
      .select({
        month: sql<string>`to_char(${transactions.date}::date, 'YYYY-MM')`,
        total: sql<string>`sum(${transactions.amount})`,
      })
      .from(transactions)
      .where(
        sql`${transactions.date} >= ${fromDateStr} AND ${transactions.amount} > 0`
      )
      .groupBy(sql`to_char(${transactions.date}::date, 'YYYY-MM')`)
      .orderBy(sql`to_char(${transactions.date}::date, 'YYYY-MM')`);

    const trends = result.map((r) => ({
      month: r.month,
      amount: parseFloat(r.total || "0"),
    }));

    return NextResponse.json({ trends });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch spending trends";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
