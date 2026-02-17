/**
 * Weekly financial digest generator.
 * Pulls spending, net worth, and anomaly data, then uses Gemini to write
 * a plain-English summary stored in the `digests` table.
 *
 * Called automatically by the in-process scheduler every Monday at 08:00.
 * Can also be triggered manually via the Ticker chat ("give me my weekly digest").
 */
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { digests } from "@/lib/db/schema";
import { getSpendingSummary } from "@/lib/agent/tools/spending-summary";
import { getAccountBalances } from "@/lib/agent/tools/account-balances";
import { getRecurringExpenses } from "@/lib/agent/tools/recurring-expenses";
import { detectSpendingAnomalies } from "@/lib/agent/tools/detect-anomalies";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export interface DigestRecord {
  id: string;
  periodFrom: string;
  periodTo: string;
  summaryMarkdown: string;
  createdAt: string;
}

/** Return the most recently generated digest, or null if none exists. */
export async function getLatestDigest(): Promise<DigestRecord | null> {
  const rows = await db
    .select()
    .from(digests)
    .orderBy(desc(digests.createdAt))
    .limit(1);

  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    periodFrom: String(r.periodFrom),
    periodTo: String(r.periodTo),
    summaryMarkdown: r.summaryMarkdown,
    createdAt: r.createdAt.toISOString(),
  };
}

/** Generate a digest for the past 7 days and store it. */
export async function generateWeeklyDigest(): Promise<DigestRecord> {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split("T")[0];

  const [spending, accounts, recurring, anomalies] = await Promise.all([
    getSpendingSummary({ from: weekAgoStr, to: todayStr }),
    getAccountBalances(),
    getRecurringExpenses(),
    detectSpendingAnomalies(),
  ]);

  const topCategories = spending.summary
    .slice(0, 5)
    .map((r) => `- ${r.category}: $${r.amount.toFixed(2)} (${r.count} txns)`)
    .join("\n");

  const prompt = `Generate a weekly financial digest for ${weekAgoStr} to ${todayStr}.

SPENDING THIS WEEK:
  Total: $${spending.totalSpend.toFixed(2)}
  Top categories:
${topCategories}

CURRENT NET WORTH: $${accounts.netWorth.toFixed(2)}
  Assets: $${accounts.totalAssets.toFixed(2)} | Liabilities: $${accounts.totalLiabilities.toFixed(2)}

RECURRING EXPENSES: $${recurring.totalMonthlyEstimate.toFixed(2)}/month across ${recurring.items.length} items

ANOMALIES:
${anomalies.anomalies.length > 0 ? anomalies.anomalies.map((a) => `- ${a}`).join("\n") : "- None detected"}

Write a 3-5 bullet-point weekly summary in Markdown. Each bullet should be a concrete, data-driven observation. Start with a one-sentence headline. Do not give financial advice.`;

  const { text } = await generateText({
    model: google("gemini-2.5-flash-lite"),
    system:
      "You are a financial data assistant writing a concise weekly digest. " +
      "Be factual, brief, and data-driven. Use markdown bullets. No advice.",
    prompt,
    abortSignal: AbortSignal.timeout(30_000),
  });

  const [created] = await db
    .insert(digests)
    .values({
      periodFrom: weekAgoStr,
      periodTo: todayStr,
      summaryMarkdown: text,
    })
    .returning();

  console.log(`[digest] Weekly digest generated for ${weekAgoStr}→${todayStr}`);

  return {
    id: created.id,
    periodFrom: String(created.periodFrom),
    periodTo: String(created.periodTo),
    summaryMarkdown: created.summaryMarkdown,
    createdAt: created.createdAt.toISOString(),
  };
}
