/**
 * PDF Report Generation API
 *
 * PDF-01: Dashboard button triggers this endpoint
 * PDF-03: AI-generated narrative via Gemini
 * PDF-05: Chat agent can also trigger report generation
 * PDF-06: No files written to disk — binary buffer response
 *
 * Uses Node.js runtime for DB access and PDFKit.
 */
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { gte, lte, gt, sql, eq, isNotNull, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { balanceSnapshots, transactions, accounts as accountsTable } from "@/lib/db/schema";
import { getSpendingSummary } from "@/lib/agent/tools/spending-summary";
import { getAccountBalances } from "@/lib/agent/tools/account-balances";
import { getRecurringExpenses } from "@/lib/agent/tools/recurring-expenses";
import {
  generatePdfReport,
  type NetWorthPoint,
  type MonthlyTrend,
  type MerchantSpend,
} from "@/lib/ai/pdf";
import type { SpendingSummaryResult } from "@/lib/agent/tools/spending-summary";
import type { AccountBalancesResult } from "@/lib/agent/tools/account-balances";
import type { RecurringExpensesResult } from "@/lib/agent/tools/recurring-expenses";
import { apiError } from "@/lib/api/error";
import { logAuditEvent } from "@/lib/audit-log";

export const runtime = "nodejs";

const reportRateLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60,
  blockDuration: 60,
});

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const requestSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    try {
      await reportRateLimiter.consume(ip);
    } catch {
      return new Response(
        JSON.stringify({ error: "Too many report requests. Please wait." }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid date range. Use YYYY-MM-DD format." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const { from, to } = parsed.data;

    // ── Fetch all data in parallel ────────────────────────────────────────────
    const [spending, accountBalances, recurring, netWorthHistory, monthlyTrends, topMerchants] =
      await Promise.all([
        getSpendingSummary({ from, to }),
        getAccountBalances(),
        getRecurringExpenses(),
        fetchNetWorthHistory(90),
        fetchMonthlyTrends(6),
        fetchTopMerchants(from, to, 10),
      ]);

    // ── Generate AI narrative with full context ───────────────────────────────
    const narrativePrompt = buildNarrativePrompt(
      from, to, spending, accountBalances, recurring, monthlyTrends, topMerchants,
    );

    const { text: narrative } = await generateText({
      model: google("gemini-2.5-flash-lite"),
      system:
        "You are a financial data analyst. Write a concise 2-3 paragraph summary of the " +
        "user's financial data. Focus on notable patterns, top categories, net worth, and " +
        "monthly trends. Do NOT give financial advice. Be factual and data-driven.",
      prompt: narrativePrompt,
      abortSignal: AbortSignal.timeout(15_000),
    });

    // ── Detect anomalies ──────────────────────────────────────────────────────
    const anomalies = detectAnomalies(spending, monthlyTrends);

    // ── Generate PDF ──────────────────────────────────────────────────────────
    const pdfBuffer = await generatePdfReport({
      from,
      to,
      spending,
      accounts: accountBalances,
      recurring,
      netWorthHistory,
      monthlyTrends,
      topMerchants,
      narrative,
      anomalies,
    });

    await logAuditEvent("report_download", ip, { from, to });

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="financial-report-${from}-to-${to}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error: unknown) {
    console.error("[ai/report] Error:", error instanceof Error ? error.message : "Unknown error");
    return apiError(error, "Failed to generate report");
  }
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchNetWorthHistory(days: number): Promise<NetWorthPoint[]> {
  const from = new Date();
  from.setDate(from.getDate() - days);
  const fromStr = from.toISOString().split("T")[0];

  const rows = await db
    .select({
      date: balanceSnapshots.snapshotDate,
      netWorth: sql<string>`sum(
        CASE
          WHEN ${accountsTable.type} IN ('credit', 'loan')
            THEN -abs(${balanceSnapshots.currentBalance})
          ELSE ${balanceSnapshots.currentBalance}
        END
      )`,
    })
    .from(balanceSnapshots)
    .innerJoin(accountsTable, sql`${balanceSnapshots.accountId} = ${accountsTable.id}`)
    .where(gte(balanceSnapshots.snapshotDate, fromStr))
    .groupBy(balanceSnapshots.snapshotDate)
    .orderBy(balanceSnapshots.snapshotDate);

  return rows.map((r) => ({
    date: String(r.date),
    netWorth: parseFloat(r.netWorth || "0"),
  }));
}

async function fetchMonthlyTrends(months: number): Promise<MonthlyTrend[]> {
  const from = new Date();
  from.setMonth(from.getMonth() - months);
  const fromStr = from.toISOString().split("T")[0];

  const rows = await db
    .select({
      month: sql<string>`to_char(${transactions.date}::date, 'YYYY-MM')`,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(
      sql`${transactions.date} >= ${fromStr}
        AND ${transactions.amount} > 0
        AND ${transactions.pending} = false`,
    )
    .groupBy(sql`to_char(${transactions.date}::date, 'YYYY-MM')`)
    .orderBy(sql`to_char(${transactions.date}::date, 'YYYY-MM')`);

  return rows.map((r) => ({
    month: r.month,
    amount: parseFloat(r.total || "0"),
  }));
}

async function fetchTopMerchants(
  from: string,
  to: string,
  limit: number,
): Promise<MerchantSpend[]> {
  const rows = await db
    .select({
      merchantName: transactions.merchantName,
      total: sql<string>`sum(${transactions.amount})`,
      count: sql<number>`count(*)::int`,
    })
    .from(transactions)
    .innerJoin(accountsTable, eq(transactions.accountId, accountsTable.id))
    .where(
      and(
        gte(transactions.date, from),
        lte(transactions.date, to),
        gt(transactions.amount, "0"),
        eq(transactions.pending, false),
        isNotNull(transactions.merchantName),
      ),
    )
    .groupBy(transactions.merchantName)
    .orderBy(sql`sum(${transactions.amount}) desc`)
    .limit(limit);

  return rows.map((r) => ({
    name: r.merchantName!,
    amount: parseFloat(r.total ?? "0"),
    count: r.count,
  }));
}

// ─── Narrative prompt builder ─────────────────────────────────────────────────

function buildNarrativePrompt(
  from: string,
  to: string,
  spending: SpendingSummaryResult,
  accountBalances: AccountBalancesResult,
  recurring: RecurringExpensesResult,
  monthlyTrends: MonthlyTrend[],
  topMerchants: MerchantSpend[],
): string {
  const categoryBreakdown = spending.summary
    .slice(0, 8)
    .map((r) => `  - ${r.category}: $${r.amount.toFixed(2)} (${r.count} txns)`)
    .join("\n");

  const trendSummary = monthlyTrends
    .map((t) => `  ${t.month}: $${t.amount.toFixed(2)}`)
    .join("\n");

  const merchantSummary = topMerchants
    .slice(0, 6)
    .map((m) => `  - ${m.name}: $${m.amount.toFixed(2)} (${m.count} txns)`)
    .join("\n");

  return `Summarize this financial report for ${from} to ${to}:

SPENDING (period):
  Total: $${spending.totalSpend.toFixed(2)}
  Categories:
${categoryBreakdown}

NET WORTH (current):
  Total assets: $${accountBalances.totalAssets.toFixed(2)}
  Total liabilities: $${accountBalances.totalLiabilities.toFixed(2)}
  Net worth: $${accountBalances.netWorth.toFixed(2)}

RECURRING EXPENSES:
  Estimated monthly total: $${recurring.totalMonthlyEstimate.toFixed(2)}/mo
  Active items: ${recurring.items.length}

MONTHLY SPENDING TREND (last 6 months):
${trendSummary}

TOP MERCHANTS (this period):
${merchantSummary}

Write 2-3 concise, data-driven paragraphs. Be factual. Do not give financial advice.`;
}

// ─── Anomaly detection ────────────────────────────────────────────────────────

function detectAnomalies(
  spending: SpendingSummaryResult,
  monthlyTrends: MonthlyTrend[],
): string[] {
  const anomalies: string[] = [];

  // Category anomalies: any category spending >2× the per-category average
  if (spending.summary.length > 1) {
    const avg = spending.totalSpend / spending.summary.length;
    for (const row of spending.summary) {
      if (row.amount > avg * 2) {
        const name = row.category
          .split("_")
          .map((w) => (w === "AND" ? "&" : w.charAt(0) + w.slice(1).toLowerCase()))
          .join(" ");
        anomalies.push(
          `${name} spending ($${row.amount.toFixed(2)}) is more than 2× the category average ($${avg.toFixed(2)}).`,
        );
      }
    }
  }

  // Month-over-month spike: current month >30% higher than the previous month
  if (monthlyTrends.length >= 2) {
    const prev = monthlyTrends[monthlyTrends.length - 2].amount;
    const curr = monthlyTrends[monthlyTrends.length - 1].amount;
    if (prev > 0 && curr > prev * 1.3) {
      const pct = Math.round(((curr - prev) / prev) * 100);
      anomalies.push(
        `Spending this month ($${curr.toFixed(2)}) is ${pct}% higher than the previous month ($${prev.toFixed(2)}).`,
      );
    }
  }

  return anomalies;
}
