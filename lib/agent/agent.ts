/**
 * AGNT-01: ReAct agent executor powered by Gemini 2.5 Flash Lite via Vercel AI SDK
 * AGNT-02: Streams responses token-by-token
 * AGNT-05: Plain English error messages
 * AGNT-06: All numbers grounded through tool calls
 * SEC-05: Iteration cap via stopWhen(stepCountIs(6))
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

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});
const model = google("gemini-2.5-flash-lite");

const agentTools = {
  getSpendingSummary: tool({
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

  getAccountBalances: tool({
    description:
      "Get current balances for all linked bank accounts. Returns each account's balance plus total assets, liabilities, and net worth.",
    inputSchema: z.object({}),
    execute: async () => getAccountBalances(),
  }),

  searchTransactions: tool({
    description:
      "Search transactions by merchant name or keyword, optionally filtered by date range. Returns matching transactions with amounts, dates, and categories.",
    inputSchema: transactionSearchSchema,
    execute: async (params) => searchTransactions(params),
  }),

  compareTrends: tool({
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

  getRecurringExpenses: tool({
    description:
      "List all detected recurring expenses (subscriptions, bills) with amounts, frequency, and estimated monthly total.",
    inputSchema: z.object({}),
    execute: async () => getRecurringExpenses(),
  }),

  generateReport: tool({
    description:
      "Generate a PDF financial report for a date range. Returns a URL the user can click to download the report. Use this when the user asks for a report, summary PDF, or says something like 'give me a report for January'.",
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
      reportUrl: `/api/ai/report`,
      from: params.from,
      to: params.to,
      instructions:
        "Tell the user their report is ready and provide a download link. The user's browser will need to POST to the report URL with the from/to dates to download the PDF.",
    }),
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
    // SEC-05: Cap at 6 reasoning steps to prevent unbounded loops
    stopWhen: stepCountIs(6),
    // 30-second timeout guard
    abortSignal: AbortSignal.timeout(30_000),
    onError: ({ error }) => {
      console.error("[agent] Stream error:", error);
    },
  });
}
