/**
 * AI narrative for the PDF report.
 *
 * Merchant, account, and institution names are replaced with aliases before
 * the prompt leaves the process; aliases in the response are restored before
 * the narrative is rendered.
 */
import { generateText } from "ai";
import { getAiTimeoutMs, getLanguageModel } from "@/lib/ai/model";
import { PiiMasker } from "@/lib/agent/pii-masker";
import type { MonthlyTrend, MerchantSpend } from "@/lib/ai/pdf";
import type { SpendingSummaryResult } from "@/lib/agent/tools/spending-summary";
import type { AccountBalancesResult } from "@/lib/agent/tools/account-balances";
import type { RecurringExpensesResult } from "@/lib/agent/tools/recurring-expenses";

export interface ReportNarrativeInput {
  from: string;
  to: string;
  spending: SpendingSummaryResult;
  accountBalances: AccountBalancesResult;
  recurring: RecurringExpensesResult;
  monthlyTrends: MonthlyTrend[];
  topMerchants: MerchantSpend[];
}

export async function generateReportNarrative(input: ReportNarrativeInput): Promise<string> {
  const masker = new PiiMasker();
  await masker.seedFromDatabase();
  for (const merchant of input.topMerchants) {
    masker.registerMerchant(merchant.name);
  }

  const { text } = await generateText({
    model: getLanguageModel("report"),
    system:
      "You are a financial data analyst. Write a concise 2-3 paragraph summary of the " +
      "user's financial data. Focus on notable patterns, top categories, net worth, and " +
      "monthly trends. Do NOT give financial advice. Be factual and data-driven.",
    prompt: masker.maskText(buildNarrativePrompt(input)),
    abortSignal: AbortSignal.timeout(getAiTimeoutMs("report")),
  });

  return masker.unmaskText(text);
}

function buildNarrativePrompt({
  from,
  to,
  spending,
  accountBalances,
  recurring,
  monthlyTrends,
  topMerchants,
}: ReportNarrativeInput): string {
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
