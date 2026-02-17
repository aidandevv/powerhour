import { NextRequest, NextResponse } from "next/server";
import { gte, gt, sql, eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, accounts } from "@/lib/db/schema";
import { apiError } from "@/lib/api/error";

export async function GET(req: NextRequest) {
  try {
    const months = Math.min(parseInt(req.nextUrl.searchParams.get("months") || "6", 10), 12);

    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - months);
    const fromDateStr = fromDate.toISOString().split("T")[0];

    const rows = await db
      .select({
        month: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
        channel: transactions.paymentChannel,
        total: sql<string>`sum(${transactions.amount})`,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(
        and(
          gte(transactions.date, fromDateStr),
          gt(transactions.amount, "0"),
          eq(transactions.pending, false)
        )
      )
      .groupBy(sql`to_char(${transactions.date}, 'YYYY-MM')`, transactions.paymentChannel)
      .orderBy(sql`to_char(${transactions.date}, 'YYYY-MM')`);

    // Build all months in range
    const allMonths: string[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      allMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    // Pivot by channel
    const monthMap = new Map<string, { online: number; inStore: number; other: number }>();
    for (const month of allMonths) {
      monthMap.set(month, { online: 0, inStore: 0, other: 0 });
    }
    for (const row of rows) {
      const entry = monthMap.get(row.month);
      if (!entry) continue;
      const amount = parseFloat(row.total ?? "0");
      const ch = row.channel?.toLowerCase() ?? "";
      if (ch === "online") entry.online += amount;
      else if (ch === "in store") entry.inStore += amount;
      else entry.other += amount;
    }

    const trends = allMonths.map((month) => ({
      month,
      ...(monthMap.get(month) ?? { online: 0, inStore: 0, other: 0 }),
    }));

    return NextResponse.json({ trends });
  } catch (error: unknown) {
    return apiError(error, "Failed to fetch channel trends");
  }
}
