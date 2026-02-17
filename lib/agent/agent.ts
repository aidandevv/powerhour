/**
 * ReAct agent powered by Gemini 2.5 Flash Lite via Vercel AI SDK.
 * Streams responses token-by-token with an 8-step iteration cap.
 *
 * Tool keys use snake_case because Gemini models normalise camelCase
 * to snake_case in their function calls, causing SDK mismatches.
 */
import {
  streamText,
  tool,
  stepCountIs,
  convertToModelMessages,
  type UIMessage,
} from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { buildSystemPrompt } from "./prompt";

// Tool function imports
import { getSpendingSummary } from "./tools/spending-summary";
import { getAccountBalances } from "./tools/account-balances";
import {
  searchTransactions,
  transactionSearchSchema,
} from "./tools/transaction-search";
import { compareTrends } from "./tools/trend-comparison";
import { getRecurringExpenses } from "./tools/recurring-expenses";
import { auditRecurringExpenses } from "./tools/recurring-audit";
import { getCashFlowForecast } from "./tools/cash-flow-forecast";
import { getMerchantCategoryInfo } from "./tools/merchant-category-info";
import { detectSpendingAnomalies } from "./tools/detect-anomalies";
import { getDebtPayoff } from "./tools/debt-payoff";
import { getLatestDigest, generateWeeklyDigest } from "@/lib/digest/generate";
import { suggestTransactionsForGroup } from "./tools/suggest-transactions-for-group";
import { createExpenseGroup } from "./tools/create-expense-group";
import { addTransactionsToGroup } from "./tools/add-transactions-to-group";
import { getCreditUtilization } from "./tools/credit-utilization";
import { getNetWorthHistory } from "./tools/net-worth-history";
import { getCategoryTrends } from "./tools/category-trends";
import { getPaymentChannels } from "./tools/payment-channels";
import { getBudgetGoals } from "./tools/budget-goals";
import { getSavingsTargets } from "./tools/savings-targets";
import { createSavingsTargetRecord } from "./tools/create-savings-target";
import { getSpendingInsights } from "./tools/spending-insights";
import { computeSavingsProjection } from "./tools/savings-projection";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});
const model = google("gemini-2.5-flash-lite");

const agentTools = {
  get_spending_summary: tool({
    description:
      "Get a spending summary by category for a date range. Returns total spend and breakdown by category.",
    inputSchema: z.object({
      from: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe("Start date in YYYY-MM-DD format"),
      to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe("End date in YYYY-MM-DD format"),
      category: z
        .string()
        .optional()
        .describe("Optional category filter (e.g. FOOD_AND_DRINK)"),
    }),
    execute: async (params) => getSpendingSummary(params),
  }),

  get_account_balances: tool({
    description:
      "Get current balances for all linked bank accounts. Returns each account's balance plus total assets, liabilities, and net worth.",
    inputSchema: z.object({}),
    execute: async () => getAccountBalances(),
  }),

  search_transactions: tool({
    description:
      "Search transactions by merchant name or keyword, optionally filtered by date range. Returns matching transactions with amounts, dates, and categories.",
    inputSchema: transactionSearchSchema,
    execute: async (params) => searchTransactions(params),
  }),

  compare_trends: tool({
    description:
      "Compare spending between two time periods. Returns totals for each period, the dollar difference, percentage change, and trend direction.",
    inputSchema: z.object({
      period1From: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe("Period 1 start date (YYYY-MM-DD)"),
      period1To: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe("Period 1 end date (YYYY-MM-DD)"),
      period2From: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe("Period 2 start date (YYYY-MM-DD)"),
      period2To: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe("Period 2 end date (YYYY-MM-DD)"),
      category: z
        .string()
        .optional()
        .describe("Optional category filter"),
    }),
    execute: async (params) => compareTrends(params),
  }),

  get_recurring_expenses: tool({
    description:
      "List all detected recurring expenses (subscriptions, bills) with amounts, frequency, and estimated monthly total.",
    inputSchema: z.object({}),
    execute: async () => getRecurringExpenses(),
  }),

  audit_recurring_expenses: tool({
    description:
      "Audit recurring expenses for unused subscriptions. Flags items with no charges in 90+ days (possible cancellations). Use when user asks to 'review subscriptions', 'audit recurring', 'find unused subscriptions', or 'what can I cancel'.",
    inputSchema: z.object({}),
    execute: async () => auditRecurringExpenses(),
  }),

  get_cash_flow_forecast: tool({
    description:
      "Forecast cash flow: available balance vs projected recurring outflows for next 30/60/90 days. Identifies potential shortfalls. Use when user asks 'will I have enough for rent/bills next month?', 'can I cover my expenses?', or 'cash flow forecast'.",
    inputSchema: z.object({}),
    execute: async () => getCashFlowForecast(),
  }),

  get_merchant_category_info: tool({
    description:
      "Get category breakdown for a merchant. Use when user asks 'why is X categorized as Y?', 're categorize X', or 'DoorDash is showing as Shopping'. Returns category distribution and suggests recategorization if appropriate.",
    inputSchema: z.object({
      merchant: z.string().min(1).max(80).describe("Merchant name to look up (e.g. DoorDash, Netflix)"),
    }),
    execute: async (params) => getMerchantCategoryInfo(params.merchant),
  }),

  generate_report: tool({
    description:
      "Generate a PDF financial report for a date range. Use when the user asks for a report, summary PDF, or says 'give me a report for January'. The UI will render a download button.",
    inputSchema: z.object({
      from: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe("Report start date (YYYY-MM-DD)"),
      to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe("Report end date (YYYY-MM-DD)"),
    }),
    execute: async (params) => ({
      status: "ready" as const,
      from: params.from,
      to: params.to,
    }),
  }),

  detect_anomalies: tool({
    description:
      "Detect unusual spending patterns: categories that are abnormally high and month-over-month spikes. Use when the user asks 'anything unusual?', 'any spending spikes?', or 'what should I watch out for?'.",
    inputSchema: z.object({}),
    execute: async () => detectSpendingAnomalies(),
  }),

  get_debt_payoff: tool({
    description:
      "Calculate debt payoff timelines for credit card accounts. Shows months to pay off at minimum payment vs accelerated 3% payment, and total interest saved. Use when user asks 'when will I pay off my credit card?', 'how long to be debt-free?', or 'debt payoff plan'.",
    inputSchema: z.object({}),
    execute: async () => getDebtPayoff(),
  }),

  get_weekly_digest: tool({
    description:
      "Retrieve the latest weekly financial digest — a concise AI-written summary of last week's spending, net worth, and notable patterns. Use when user asks 'weekly summary', 'how did I do last week?', or 'give me my digest'.",
    inputSchema: z.object({
      regenerate: z
        .boolean()
        .optional()
        .describe("Set true to generate a fresh digest even if one exists for this week"),
    }),
    execute: async (params) => {
      if (params.regenerate) {
        return generateWeeklyDigest();
      }
      const latest = await getLatestDigest();
      if (!latest) {
        return generateWeeklyDigest();
      }
      return latest;
    },
  }),

  suggest_transactions_for_group: tool({
    description:
      "Suggest transactions for expense grouping by date range and optional keyword. Use when user asks 'group my Japan trip expenses', 'what did I spend on my March vacation', 'find transactions for my NYC trip', or 'show me my Japan spending'. Returns matching transactions with IDs and amounts.",
    inputSchema: z.object({
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Start date (YYYY-MM-DD)"),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("End date (YYYY-MM-DD)"),
      query: z.string().max(100).optional().describe("Optional keyword (e.g. Japan, Airbnb, hotel)"),
      limit: z.number().int().min(1).max(100).optional().default(50),
    }),
    execute: async (params) => suggestTransactionsForGroup(params),
  }),

  create_expense_group: tool({
    description:
      "Create an expense group (e.g. for a trip). Use when user says 'create a group called Japan Trip', 'group my expenses as March vacation', or 'make a new expense group for my NYC trip'.",
    inputSchema: z.object({
      name: z.string().min(1).max(200).describe("Group name (e.g. Japan Trip)"),
      description: z.string().max(500).optional(),
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Optional start date (YYYY-MM-DD)"),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Optional end date (YYYY-MM-DD)"),
    }),
    execute: async (params) => createExpenseGroup(params),
  }),

  add_transactions_to_group: tool({
    description:
      "Add transactions to an expense group. Use when user says 'add these to my Japan Trip group', 'put these transactions in the group', or 'add the suggested transactions to the group'. Requires group ID from create_expense_group and transaction IDs from suggest_transactions_for_group.",
    inputSchema: z.object({
      groupId: z.string().uuid().describe("Expense group ID"),
      transactionIds: z.array(z.string().uuid()).min(1).max(100).describe("Transaction IDs to add"),
    }),
    execute: async (params) => addTransactionsToGroup(params),
  }),

  get_credit_utilization: tool({
    description:
      "Get credit card utilization percentages for all active credit cards. Shows how much of each credit limit is being used. Use when user asks 'what's my credit utilization?', 'how much credit am I using?', 'credit card balances', 'am I close to my credit limit?', etc.",
    inputSchema: z.object({}),
    execute: async () => getCreditUtilization(),
  }),

  get_net_worth_history: tool({
    description:
      "Get net worth history over time (daily snapshots). Shows how net worth has changed and whether it's trending up, down, or stable. Use when user asks 'how has my net worth changed?', 'net worth trend', 'am I building wealth?', 'show my net worth over time', etc.",
    inputSchema: z.object({
      days: z.number().int().min(7).max(730).optional().default(180).describe("Number of days of history (default 180, max 730)"),
    }),
    execute: async (params) => getNetWorthHistory(params.days),
  }),

  get_category_trends: tool({
    description:
      "Get spending trends by category over recent months. Shows which categories are increasing, decreasing, or stable. Use when user asks 'how is my dining spending trending?', 'show spending trends by category', 'which categories am I spending more on?', 'food spending over time', etc.",
    inputSchema: z.object({
      months: z.number().int().min(3).max(12).optional().default(6).describe("Number of months of history (default 6, max 12)"),
      limit: z.number().int().min(3).max(10).optional().default(6).describe("Number of top categories to return (default 6, max 10)"),
    }),
    execute: async (params) => getCategoryTrends(params.months, params.limit),
  }),

  get_payment_channels: tool({
    description:
      "Get spending breakdown by payment channel (online, in-store, other) over recent months. Shows how spending is distributed across payment methods. Use when user asks 'how much do I spend online vs in-store?', 'payment method breakdown', 'am I shopping online more?', 'online vs offline spending', etc.",
    inputSchema: z.object({
      months: z.number().int().min(3).max(12).optional().default(6).describe("Number of months of history (default 6, max 12)"),
    }),
    execute: async (params) => getPaymentChannels(params.months),
  }),

  get_budget_goals: tool({
    description:
      "Get AI-generated budget goals with current progress for the month. Shows which goals are on track, in warning, or exceeded. Use when user asks 'what are my budget goals?', 'show my budget progress', 'how am I doing on my budget goals?', 'am I over budget?', etc.",
    inputSchema: z.object({}),
    execute: async () => getBudgetGoals(),
  }),

  get_savings_targets: tool({
    description:
      "Get active savings targets/goals with timeline and monthly requirement. Use when user asks 'what are my savings goals?', 'show my savings targets', 'am I on track for my savings goal?', 'how much do I need to save per month?', etc.",
    inputSchema: z.object({}),
    execute: async () => getSavingsTargets(),
  }),

  create_savings_target: tool({
    description:
      "Create a new savings target/goal with a target amount and date. Calculates required monthly savings. Use when user says 'I want to save $5000 by December', 'create a savings goal', 'help me save for a vacation', etc.",
    inputSchema: z.object({
      name: z.string().min(1).max(200).describe("Name of the savings goal (e.g. 'Emergency Fund', 'Vacation to Japan')"),
      targetAmount: z.number().positive().describe("Target amount in dollars"),
      targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Target date (YYYY-MM-DD)"),
    }),
    execute: async (params) => createSavingsTargetRecord(params),
  }),

  get_spending_insights: tool({
    description:
      "Get comprehensive spending insights including 3-month spending summary, recurring expenses, and subscription audit. Use when user asks for a 'spending overview', 'financial snapshot', or 'overall spending summary'.",
    inputSchema: z.object({}),
    execute: async () => getSpendingInsights(),
  }),

  compute_savings_projection: tool({
    description:
      "Project how long it will take to reach a savings goal given current income/spending, or calculate required monthly savings to hit a target by a specific date. Use when user asks 'when can I afford X?', 'how long to save for Y?', 'how much to save per month for Z?', etc.",
    inputSchema: z.object({
      targetAmount: z.number().positive().describe("Target savings amount in dollars"),
      targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Optional target date (YYYY-MM-DD). If provided, calculates required monthly savings."),
      monthlyAmount: z.number().positive().optional().describe("Optional monthly savings amount. If provided, calculates timeline to reach goal."),
    }),
    execute: async (params) => computeSavingsProjection(params),
  }),
};

export type AgentTools = typeof agentTools;

/**
 * Run the agent with streaming. Returns a streamText result that can be
 * converted to a streaming response via .toUIMessageStreamResponse().
 */
export async function runAgent(messages: UIMessage[]) {
  const modelMessages = await convertToModelMessages(messages);

  return streamText({
    model,
    system: buildSystemPrompt(),
    messages: modelMessages,
    tools: agentTools,
    stopWhen: stepCountIs(8),
    abortSignal: AbortSignal.timeout(90_000),
    onError: ({ error }) => {
      console.error("[agent] Stream error:", error);
    },
  });
}
