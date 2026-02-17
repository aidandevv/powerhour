/**
 * Payment channel trends — shows how spending is distributed across payment methods (online, in-store, other).
 * Use when user asks "how much do I spend online vs in-store?", "payment method breakdown", "am I shopping online more?", etc.
 */
import { gte, gt, sql, eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, accounts } from "@/lib/db/schema";

export interface ChannelDataPoint {
  month: string;
  online: number;
  inStore: number;
  other: number;
}

export interface PaymentChannelsResult {
  trends: ChannelDataPoint[];
  summary: string;
  totalOnline: number;
  totalInStore: number;
  totalOther: number;
  onlinePercent: number;
  inStorePercent: number;
  otherPercent: number;
}

export async function getPaymentChannels(months = 6): Promise<PaymentChannelsResult> {
  const maxMonths = Math.min(months, 12);

  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - maxMonths);
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
  for (let i = maxMonths - 1; i >= 0; i--) {
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

  const trends: ChannelDataPoint[] = allMonths.map((month) => ({
    month,
    ...(monthMap.get(month) ?? { online: 0, inStore: 0, other: 0 }),
  }));

  // Calculate totals
  const totalOnline = trends.reduce((sum, t) => sum + t.online, 0);
  const totalInStore = trends.reduce((sum, t) => sum + t.inStore, 0);
  const totalOther = trends.reduce((sum, t) => sum + t.other, 0);
  const grandTotal = totalOnline + totalInStore + totalOther;

  const onlinePercent = grandTotal > 0 ? (totalOnline / grandTotal) * 100 : 0;
  const inStorePercent = grandTotal > 0 ? (totalInStore / grandTotal) * 100 : 0;
  const otherPercent = grandTotal > 0 ? (totalOther / grandTotal) * 100 : 0;

  let summary = "";
  if (grandTotal === 0) {
    summary = "No spending data found for the selected period.";
  } else {
    summary = `Over the past ${maxMonths} months, you spent $${grandTotal.toFixed(0)} total: `;
    summary += `${onlinePercent.toFixed(0)}% online ($${totalOnline.toFixed(0)}), `;
    summary += `${inStorePercent.toFixed(0)}% in-store ($${totalInStore.toFixed(0)})`;
    if (otherPercent > 0) {
      summary += `, ${otherPercent.toFixed(0)}% other ($${totalOther.toFixed(0)})`;
    }
    summary += ".";
  }

  return {
    trends,
    summary,
    totalOnline,
    totalInStore,
    totalOther,
    onlinePercent,
    inStorePercent,
    otherPercent,
  };
}
