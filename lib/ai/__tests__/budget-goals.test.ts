import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  generateObjectMock,
  getSpendingSummaryMock,
  getRecurringExpensesMock,
  insertValuesMock,
} = vi.hoisted(() => ({
  generateObjectMock: vi.fn(),
  getSpendingSummaryMock: vi.fn(),
  getRecurringExpensesMock: vi.fn(),
  insertValuesMock: vi.fn(),
}));

vi.mock("ai", () => ({ generateObject: generateObjectMock }));
vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: () => (modelId: string) => ({ modelId }),
}));
vi.mock("@/lib/agent/tools/spending-summary", () => ({
  getSpendingSummary: getSpendingSummaryMock,
}));
vi.mock("@/lib/agent/tools/recurring-expenses", () => ({
  getRecurringExpenses: getRecurringExpensesMock,
}));
vi.mock("@/lib/db", () => ({
  db: {
    transaction: async (fn: (tx: unknown) => Promise<void>) =>
      fn({
        delete: () => ({ where: async () => undefined }),
        insert: () => ({ values: insertValuesMock }),
      }),
  },
}));

import { PiiMasker } from "@/lib/agent/pii-masker";
import { generateAndStoreBudgetGoals } from "../budget-goals";

function goal(overrides: Record<string, unknown>) {
  return {
    category: "ENTERTAINMENT",
    categoryLabel: "Entertainment",
    targetType: "cap",
    monthlyTarget: 40,
    baselineMonthlySpend: 60,
    rationale: "Trim discretionary spend.",
    ...overrides,
  };
}

describe("generateAndStoreBudgetGoals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(PiiMasker.prototype, "seedFromDatabase").mockImplementation(
      async function (this: PiiMasker) {
        this.registerAccount("Everyday Checking");
      }
    );
    getSpendingSummaryMock.mockResolvedValue({
      summary: [{ category: "ENTERTAINMENT", amount: 180, count: 6 }],
      totalSpend: 180,
    });
    getRecurringExpensesMock.mockResolvedValue({
      items: [
        { name: "Netflix", amount: 15.49, frequency: "MONTHLY" },
        { name: "Riverside Climbing Gym", amount: 89, frequency: "MONTHLY" },
      ],
      totalMonthlyEstimate: 104.49,
    });
  });

  it("sends aliases instead of recurring item names to the model", async () => {
    generateObjectMock.mockResolvedValue({
      object: { goals: [goal({}), goal({}), goal({})] },
    });

    await generateAndStoreBudgetGoals({
      tier: "balanced",
      upcomingExpenses: "Annual Everyday Checking fee and a Netflix price bump",
    });

    expect(generateObjectMock).toHaveBeenCalledOnce();
    const { schema: _schema, ...request } = generateObjectMock.mock.calls[0][0];
    const serialized = JSON.stringify(request);
    expect(serialized).not.toContain("Netflix");
    expect(serialized).not.toContain("Riverside Climbing Gym");
    expect(serialized).not.toContain("Everyday Checking");
    expect(serialized).toContain("Merchant-1");
    expect(serialized).toContain("Merchant-2");
    expect(serialized).toContain("Account-A");
  });

  it("stores goal text with aliases restored", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        goals: [
          goal({
            categoryLabel: "Merchant-2 membership",
            rationale: "Merchant-2 costs $89/mo; pause it for a month.",
          }),
          goal({ rationale: "Drop Merchant-1 to the basic plan." }),
          goal({}),
        ],
      },
    });

    await generateAndStoreBudgetGoals();

    const rows = insertValuesMock.mock.calls[0][0];
    expect(rows[0].categoryLabel).toBe("Riverside Climbing Gym membership");
    expect(rows[0].rationale).toBe(
      "Riverside Climbing Gym costs $89/mo; pause it for a month."
    );
    expect(rows[1].rationale).toBe("Drop Netflix to the basic plan.");
  });
});
