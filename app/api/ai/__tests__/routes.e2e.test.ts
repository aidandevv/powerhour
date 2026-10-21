import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  runAgentMock,
  runBudgetPlannerAgentMock,
  seedFromDatabaseMock,
  maskerCtorMock,
} = vi.hoisted(() => ({
  runAgentMock: vi.fn(),
  runBudgetPlannerAgentMock: vi.fn(),
  seedFromDatabaseMock: vi.fn(),
  maskerCtorMock: vi.fn(),
}));

vi.mock("@/lib/agent/agent", () => ({
  runAgent: runAgentMock,
}));

vi.mock("@/lib/agent/budget-planner-agent", () => ({
  runBudgetPlannerAgent: runBudgetPlannerAgentMock,
}));

vi.mock("@/lib/agent/pii-masker", () => ({
  PiiMasker: class MockPiiMasker {
    constructor() {
      maskerCtorMock(this);
    }

    seedFromDatabase = seedFromDatabaseMock;
  },
}));

vi.mock("@/lib/api/error", () => ({
  apiError: vi.fn((error: unknown, message: string) =>
    new Response(JSON.stringify({ error: message, detail: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  ),
}));

describe("AI routes PII e2e", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    seedFromDatabaseMock.mockResolvedValue(undefined);
    runAgentMock.mockResolvedValue({
      toUIMessageStreamResponse: () => new Response("chat-ok"),
    });
    runBudgetPlannerAgentMock.mockResolvedValue({
      toUIMessageStreamResponse: () => new Response("planner-ok"),
    });
  });

  it("seeds a request-scoped masker before invoking the chat agent", async () => {
    const { POST } = await import("../chat/route");

    const response = await POST(
      new Request("http://localhost/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ id: "u1", role: "user", parts: [{ type: "text", text: "hello" }] }],
        }),
      })
    );

    expect(seedFromDatabaseMock).toHaveBeenCalledTimes(1);
    expect(runAgentMock).toHaveBeenCalledWith(
      [{ id: "u1", role: "user", parts: [{ type: "text", text: "hello" }] }],
      expect.objectContaining({ seedFromDatabase: seedFromDatabaseMock })
    );
    expect(await response.text()).toBe("chat-ok");
  });

  it("seeds a request-scoped masker before invoking the budget planner agent", async () => {
    const { POST } = await import("../budget-planner/route");

    const response = await POST(
      new Request("http://localhost/api/ai/budget-planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ id: "u1", role: "user", parts: [{ type: "text", text: "plan a trip" }] }],
          budgetContext: { estimatedTotal: 5000, planTitle: "Japan" },
        }),
      })
    );

    expect(seedFromDatabaseMock).toHaveBeenCalledTimes(1);
    expect(runBudgetPlannerAgentMock).toHaveBeenCalledWith(
      [{ id: "u1", role: "user", parts: [{ type: "text", text: "plan a trip" }] }],
      { budgetContext: { estimatedTotal: 5000, planTitle: "Japan" } },
      expect.objectContaining({ seedFromDatabase: seedFromDatabaseMock })
    );
    expect(await response.text()).toBe("planner-ok");
  });
});
