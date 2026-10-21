import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TextStreamPart } from "ai";

const {
  streamTextMock,
  convertToModelMessagesMock,
  searchTransactionsMock,
} = vi.hoisted(() => ({
  streamTextMock: vi.fn(),
  convertToModelMessagesMock: vi.fn(async (messages) => messages),
  searchTransactionsMock: vi.fn(async (params) => [
    {
      id: "txn-1",
      date: "2026-04-01",
      name: "Starbucks",
      merchantName: "Starbucks",
      amount: 12.5,
      category: "FOOD_AND_DRINK",
      accountName: "Chase Checking",
    },
  ]),
}));

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    convertToModelMessages: convertToModelMessagesMock,
    streamText: streamTextMock,
    stepCountIs: vi.fn((value: number) => value),
  };
});

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn(() => "mock-model")),
}));

vi.mock("../prompt", () => ({
  buildSystemPrompt: vi.fn(() => "system prompt"),
}));

vi.mock("../tools/spending-summary", () => ({
  getSpendingSummary: vi.fn(),
}));
vi.mock("../tools/account-balances", () => ({
  getAccountBalances: vi.fn(),
}));
vi.mock("../tools/transaction-search", () => ({
  transactionSearchSchema: {
    parse: (value: unknown) => value,
  },
  searchTransactions: searchTransactionsMock,
}));
vi.mock("../tools/trend-comparison", () => ({
  compareTrends: vi.fn(),
}));
vi.mock("../tools/recurring-expenses", () => ({
  getRecurringExpenses: vi.fn(),
}));
vi.mock("../tools/recurring-audit", () => ({
  auditRecurringExpenses: vi.fn(),
}));
vi.mock("../tools/cash-flow-forecast", () => ({
  getCashFlowForecast: vi.fn(),
}));
vi.mock("../tools/merchant-category-info", () => ({
  getMerchantCategoryInfo: vi.fn(),
}));
vi.mock("../tools/detect-anomalies", () => ({
  detectSpendingAnomalies: vi.fn(),
}));
vi.mock("../tools/debt-payoff", () => ({
  getDebtPayoff: vi.fn(),
}));
vi.mock("@/lib/digest/generate", () => ({
  getLatestDigest: vi.fn(),
  generateWeeklyDigest: vi.fn(),
}));
vi.mock("../tools/suggest-transactions-for-group", () => ({
  suggestTransactionsForGroup: vi.fn(),
}));
vi.mock("../tools/create-expense-group", () => ({
  createExpenseGroup: vi.fn(),
}));
vi.mock("../tools/add-transactions-to-group", () => ({
  addTransactionsToGroup: vi.fn(),
}));
vi.mock("../tools/credit-utilization", () => ({
  getCreditUtilization: vi.fn(),
}));
vi.mock("../tools/net-worth-history", () => ({
  getNetWorthHistory: vi.fn(),
}));
vi.mock("../tools/category-trends", () => ({
  getCategoryTrends: vi.fn(),
}));
vi.mock("../tools/payment-channels", () => ({
  getPaymentChannels: vi.fn(),
}));
vi.mock("../tools/budget-goals", () => ({
  getBudgetGoals: vi.fn(),
}));
vi.mock("../tools/savings-targets", () => ({
  getSavingsTargets: vi.fn(),
}));
vi.mock("../tools/create-savings-target", () => ({
  createSavingsTargetRecord: vi.fn(),
}));
vi.mock("../tools/spending-insights", () => ({
  getSpendingInsights: vi.fn(),
}));
vi.mock("../tools/savings-projection", () => ({
  computeSavingsProjection: vi.fn(),
}));

async function collectStreamParts<TOOLS extends Record<string, never>>(
  parts: Array<TextStreamPart<TOOLS>>,
  transformFactory: (options: {
    tools: TOOLS;
    stopStream: () => void;
  }) => TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>
) {
  const stream = new ReadableStream<TextStreamPart<TOOLS>>({
    start(controller) {
      for (const part of parts) {
        controller.enqueue(part);
      }
      controller.close();
    },
  }).pipeThrough(transformFactory({ tools: {} as TOOLS, stopStream: () => {} }));

  const reader = stream.getReader();
  const output: Array<TextStreamPart<TOOLS>> = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    output.push(value);
  }
  return output;
}

describe("runAgent PII e2e", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    streamTextMock.mockReturnValue({ kind: "stream-result" });
  });

  it("masks user input, unmasks tool input, masks tool output, and unmasks assistant text", async () => {
    const [{ runAgent }, { PiiMasker }] = await Promise.all([
      import("../agent"),
      import("../pii-masker"),
    ]);

    const masker = new PiiMasker();
    masker.registerMerchant("Starbucks");
    masker.registerAccount("Chase Checking");

    const result = await runAgent(
      [
        {
          id: "u1",
          role: "user",
          parts: [{ type: "text", text: "How much did I spend at Starbucks from Chase Checking?" }],
        },
      ],
      masker
    );

    expect(result).toEqual({ kind: "stream-result" });
    expect(convertToModelMessagesMock).toHaveBeenCalledWith([
      {
        id: "u1",
        role: "user",
        parts: [{ type: "text", text: "How much did I spend at Merchant-1 from Account-A?" }],
      },
    ]);

    const streamOptions = streamTextMock.mock.calls[0][0];
    const toolResult = await streamOptions.tools.search_transactions.execute(
      { query: "Merchant-1" },
      undefined
    );

    expect(searchTransactionsMock).toHaveBeenCalledWith({ query: "Starbucks" });
    expect(toolResult).toEqual([
      expect.objectContaining({
        merchantName: "Starbucks",
        accountName: "Chase Checking",
      }),
    ]);

    const transformed = await collectStreamParts(
      [
        {
          type: "tool-result",
          toolCallId: "call-1",
          toolName: "search_transactions",
          input: { query: "Merchant-1" },
          output: toolResult,
        } as TextStreamPart<Record<string, never>>,
        { type: "text-start", id: "t1" },
        { type: "text-delta", id: "t1", text: "Found Merchant-1 on Account-A." },
        { type: "text-end", id: "t1" },
      ],
      streamOptions.experimental_transform
    );

    expect(transformed[0]).toMatchObject({
      type: "tool-result",
      output: [
        expect.objectContaining({
          merchantName: "Merchant-1",
          accountName: "Account-A",
        }),
      ],
    });
    expect(transformed[2]).toEqual({
      type: "text-delta",
      id: "t1",
      text: "Found Starbucks on Chase Checking.",
    });
  });
});
