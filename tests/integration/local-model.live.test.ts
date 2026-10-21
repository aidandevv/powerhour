import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const databaseUrl = process.env.TEST_DATABASE_URL;
const modelURL = process.env.LOCAL_MODEL_SMOKE_URL;
const modelId = process.env.LOCAL_MODEL_SMOKE_ID;
const enabled = Boolean(databaseUrl && modelURL && modelId);

if (enabled && !new URL(databaseUrl!).pathname.endsWith("_test")) {
  throw new Error("TEST_DATABASE_URL must use a database name ending in _test.");
}

describe.skipIf(!enabled)("installed local model smoke", () => {
  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", databaseUrl!);
    vi.stubEnv("DATABASE_SSL", "disable");
    vi.stubEnv("ENCRYPTION_KEY", "0".repeat(64));
    vi.stubEnv("AI_PROVIDER", "openai-compatible");
    vi.stubEnv("AI_BASE_URL", modelURL!);
    vi.stubEnv("AI_MODEL", modelId!);
    vi.stubEnv("GEMINI_API_KEY", "");
    for (const feature of ["chat", "planner", "report", "goals", "digest"]) {
      vi.stubEnv(`AI_MODEL_${feature.toUpperCase()}`, modelId!);
      vi.stubEnv(`AI_${feature.toUpperCase()}_TIMEOUT_MS`, "180000");
    }
    const { seedDemoData } = await import("@/lib/demo/seed");
    await seedDemoData();
  });

  afterAll(() => vi.unstubAllEnvs());

  it.each([
    ["chat", "Use get_account_balances to show my current net worth. Reply briefly."],
    ["budget-planner", "Use savings_projection: targetAmount 1200, monthlyAmount 100. Show months needed. Do not create a target."],
  ])("%s streams a tool result and a readable answer", async (feature, prompt) => {
    const { POST } = feature === "chat"
      ? await import("@/app/api/ai/chat/route")
      : await import("@/app/api/ai/budget-planner/route");
    const response = await POST(new Request(`http://localhost/api/ai/${feature}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ id: "live-smoke", role: "user", parts: [{ type: "text", text: prompt }] }] }),
    }));
    const stream = await response.text();
    expect(response.status).toBe(200);
    expect(stream).toContain("tool-output-available");
    expect(stream).toContain('"type":"text-delta"');
    expect(stream).not.toContain('"type":"error"');
  }, 200_000);

  it("generates three valid budget goals", async () => {
    const { POST } = await import("@/app/api/budget-goals/generate/route");
    const response = await POST(new Request("http://localhost/api/budget-goals/generate", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tier: "balanced" }),
    }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.goals.filter((goal: { status: string }) => goal.status === "suggested")).toHaveLength(3);
  }, 200_000);

  it("downloads a PDF with a generated summary", async () => {
    const { POST } = await import("@/app/api/ai/report/route");
    const response = await POST(new Request("http://localhost/api/ai/report", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: "2026-01-01", to: "2026-12-31" }),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(1000);
  }, 200_000);

  it("stores a generated weekly digest with its beta label", async () => {
    const { generateWeeklyDigest } = await import("@/lib/digest/generate");
    const digest = await generateWeeklyDigest();
    expect(digest.summaryMarkdown).toMatch(/^Local model · Beta\n\n\S/);
    expect(digest.summaryMarkdown.length).toBeGreaterThan(40);
  }, 200_000);
});
