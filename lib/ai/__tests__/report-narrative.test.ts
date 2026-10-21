import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateTextMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
}));

vi.mock("ai", () => ({ generateText: generateTextMock }));
vi.mock("@/lib/ai/model", () => ({
  getLanguageModel: (feature: string) => ({ modelId: `test-${feature}` }),
  getAiTimeoutMs: () => 180_000,
}));
vi.mock("@/lib/db", () => ({ db: {} }));

import { PiiMasker } from "@/lib/agent/pii-masker";
import { generateReportNarrative, type ReportNarrativeInput } from "../report-narrative";

const input: ReportNarrativeInput = {
  from: "2026-09-01",
  to: "2026-09-30",
  spending: {
    summary: [{ category: "FOOD_AND_DRINK", amount: 412.5, count: 18 }],
    totalSpend: 412.5,
  } as ReportNarrativeInput["spending"],
  accountBalances: {
    totalAssets: 12000,
    totalLiabilities: 3000,
    netWorth: 9000,
  } as ReportNarrativeInput["accountBalances"],
  recurring: {
    items: [],
    totalMonthlyEstimate: 0,
  } as unknown as ReportNarrativeInput["recurring"],
  monthlyTrends: [{ month: "2026-09", amount: 412.5 }],
  topMerchants: [
    { name: "Blue Bottle Coffee", amount: 120, count: 9 },
    { name: "Corner Grocery #4411", amount: 80, count: 3 },
  ],
};

describe("generateReportNarrative", () => {
  beforeEach(() => {
    generateTextMock.mockReset();
    vi.spyOn(PiiMasker.prototype, "seedFromDatabase").mockImplementation(
      async function (this: PiiMasker) {
        this.registerAccount("Everyday Checking");
      }
    );
  });

  it("sends aliases instead of merchant names to the model", async () => {
    generateTextMock.mockResolvedValue({ text: "" });

    await generateReportNarrative({
      ...input,
      topMerchants: [
        ...input.topMerchants,
        { name: "Everyday Checking Transfer", amount: 50, count: 1 },
      ],
    });

    expect(generateTextMock).toHaveBeenCalledOnce();
    const request = JSON.stringify(generateTextMock.mock.calls[0][0]);
    expect(request).not.toContain("Blue Bottle");
    expect(request).not.toContain("Corner Grocery");
    expect(request).not.toContain("Everyday Checking");
    expect(request).toContain("Merchant-1");
    expect(request).toContain("Merchant-2");
  });

  it("restores real names in the generated narrative", async () => {
    generateTextMock.mockResolvedValue({
      text: "Most spending went to Merchant-1, followed by Merchant-2.",
    });

    const narrative = await generateReportNarrative(input);

    expect(narrative).toBe(
      "Most spending went to Blue Bottle Coffee, followed by Corner Grocery."
    );
  });
});
