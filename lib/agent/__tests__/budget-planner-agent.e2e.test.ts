import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TextStreamPart } from "ai";

const {
  streamTextMock,
  convertToModelMessagesMock,
  createSavingsTargetRecordMock,
  performWebSearchMock,
} = vi.hoisted(() => ({
  streamTextMock: vi.fn(),
  convertToModelMessagesMock: vi.fn(async (messages) => messages),
  createSavingsTargetRecordMock: vi.fn(async (params) => ({
    success: true,
    ...params,
    monthlyAmount: 200,
    monthsRemaining: 10,
    summary: `Created ${params.name}`,
  })),
  performWebSearchMock: vi.fn(async (params) => ({
    query: params.query,
    results: [],
    summary: "searched",
  })),
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

vi.mock("../tools/savings-projection", () => ({
  computeSavingsProjection: vi.fn(),
}));
vi.mock("../tools/create-savings-target", () => ({
  createSavingsTargetRecord: createSavingsTargetRecordMock,
}));
vi.mock("../tools/spending-insights", () => ({
  getSpendingInsights: vi.fn(),
}));
vi.mock("../tools/account-balances", () => ({
  getAccountBalances: vi.fn(),
}));
vi.mock("../tools/recurring-expenses", () => ({
  getRecurringExpenses: vi.fn(),
}));
vi.mock("@/lib/ai/budget-goals", () => ({
  createSingleBudgetGoal: vi.fn(),
}));
vi.mock("../tools/web-search", () => ({
  performWebSearch: performWebSearchMock,
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

describe("runBudgetPlannerAgent PII e2e", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    streamTextMock.mockReturnValue({ kind: "planner-stream-result" });
  });

  it("preserves readable UI output while unmasking aliased create_savings_target inputs", async () => {
    const [{ runBudgetPlannerAgent }, { PiiMasker }] = await Promise.all([
      import("../budget-planner-agent"),
      import("../pii-masker"),
    ]);

    const masker = new PiiMasker();
    masker.registerAccount("Chase Savings");

    const result = await runBudgetPlannerAgent(
      [
        {
          id: "u1",
          role: "user",
          parts: [{ type: "text", text: "Help me turn Chase Savings into a savings goal." }],
        },
      ],
      undefined,
      masker
    );

    expect(result).toEqual({ kind: "planner-stream-result" });
    expect(convertToModelMessagesMock).toHaveBeenCalledWith([
      {
        id: "u1",
        role: "user",
        parts: [{ type: "text", text: "Help me turn Account-A into a savings goal." }],
      },
    ]);

    const streamOptions = streamTextMock.mock.calls[0][0];
    const toolResult = await streamOptions.tools.create_savings_target.execute(
      {
        name: "Boost Account-A",
        targetAmount: 2000,
        targetDate: "2026-12-31",
      },
      undefined
    );

    expect(createSavingsTargetRecordMock).toHaveBeenCalledWith({
      name: "Boost Chase Savings",
      targetAmount: 2000,
      targetDate: "2026-12-31",
    });
    expect(toolResult).toMatchObject({
      name: "Boost Chase Savings",
      summary: "Created Boost Chase Savings",
    });

    const transformed = await collectStreamParts(
      [
        {
          type: "tool-result",
          toolCallId: "call-1",
          toolName: "create_savings_target",
          input: {
            name: "Boost Account-A",
            targetAmount: 2000,
            targetDate: "2026-12-31",
          },
          output: toolResult,
        } as TextStreamPart<Record<string, never>>,
        { type: "text-start", id: "t1" },
        { type: "text-delta", id: "t1", text: "I created Boost Account-A for you." },
        { type: "text-end", id: "t1" },
      ],
      streamOptions.experimental_transform
    );

    expect(transformed[0]).toMatchObject({
      type: "tool-result",
      output: expect.objectContaining({
        name: "Merchant-1",
        summary: "Created Merchant-1",
      }),
    });
    expect(transformed[2]).toEqual({
      type: "text-delta",
      id: "t1",
      text: "I created Boost Chase Savings for you.",
    });
  });

  it("blocks web search after private finance tools have been used", async () => {
    const { runBudgetPlannerAgent } = await import("../budget-planner-agent");

    await runBudgetPlannerAgent([
      {
        id: "u1",
        role: "user",
        parts: [{ type: "text", text: "Can I afford a trip?" }],
      },
    ]);

    const streamOptions = streamTextMock.mock.calls[0][0];
    await streamOptions.tools.get_account_balances.execute({}, undefined);
    const blockedResult = await streamOptions.tools.web_search.execute(
      { query: "my Chase Savings balance flights to Paris" },
      undefined
    );

    expect(performWebSearchMock).not.toHaveBeenCalled();
    expect(blockedResult).toMatchObject({
      query: "my Chase Savings balance flights to Paris",
      results: [],
      summary: expect.stringContaining("disabled after private finance data"),
    });
  });

  it("allows public travel research before private finance tools are used", async () => {
    const { runBudgetPlannerAgent } = await import("../budget-planner-agent");

    await runBudgetPlannerAgent([
      {
        id: "u1",
        role: "user",
        parts: [{ type: "text", text: "Plan a trip to Tokyo." }],
      },
    ]);

    const streamOptions = streamTextMock.mock.calls[0][0];
    const result = await streamOptions.tools.web_search.execute(
      { query: "average hotel cost Tokyo May 2026" },
      undefined
    );

    expect(performWebSearchMock).toHaveBeenCalledWith({
      query: "average hotel cost Tokyo May 2026",
    });
    expect(result).toMatchObject({ summary: "searched" });
  });
});
