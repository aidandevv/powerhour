import { once } from "node:events";
import type { AddressInfo } from "node:net";
import postgres, { type Sql } from "postgres";
import { generateText } from "ai";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createModelServer } from "../../e2e/fixtures/model-server.mjs";
import { getLanguageModel } from "@/lib/ai/model";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !new URL(databaseUrl).pathname.endsWith("_test")) {
  throw new Error("TEST_DATABASE_URL must use a database name ending in _test.");
}

describe("OpenAI-compatible HTTP transport", () => {
  const fixture = createModelServer();
  let baseURL: string;

  beforeAll(async () => {
    fixture.server.listen(0, "127.0.0.1");
    await once(fixture.server, "listening");
    baseURL = `http://127.0.0.1:${(fixture.server.address() as AddressInfo).port}/v1`;
    vi.stubEnv("AI_PROVIDER", "openai-compatible");
    vi.stubEnv("AI_BASE_URL", baseURL);
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("DATABASE_SSL", "disable");
    vi.stubEnv("ENCRYPTION_KEY", "0".repeat(64));
    for (const feature of ["chat", "planner", "report", "goals", "digest"]) {
      vi.stubEnv(`AI_MODEL_${feature.toUpperCase()}`, `smoke-${feature}`);
    }
    if (databaseUrl) vi.stubEnv("DATABASE_URL", databaseUrl);
  });

  afterAll(async () => {
    fixture.server.closeAllConnections();
    await new Promise<void>((resolve) => fixture.server.close(() => resolve()));
    vi.unstubAllEnvs();
  });

  it("uses the real SDK over HTTP without a Gemini key", async () => {
    const result = await generateText({ model: getLanguageModel("report"), prompt: "Test summary" });
    expect(result.text).toBe("Local model response received.");
    expect(fixture.requests.at(-1).model).toBe("smoke-report");
  });

  it("propagates model server failures", async () => {
    await expect(generateText({
      model: getLanguageModel("report", { AI_PROVIDER: "openai-compatible", AI_BASE_URL: baseURL, AI_MODEL: "smoke-error" }),
      prompt: "Test", maxRetries: 0,
    })).rejects.toThrow("Test model unavailable");
  });

  it("aborts an unresponsive local model", async () => {
    await expect(generateText({
      model: getLanguageModel("report", { AI_PROVIDER: "openai-compatible", AI_BASE_URL: baseURL, AI_MODEL: "smoke-slow" }),
      prompt: "Test", abortSignal: AbortSignal.timeout(50), maxRetries: 0,
    })).rejects.toThrow();
  });

  describe.skipIf(!databaseUrl)("AI feature paths with PostgreSQL", () => {
    let sql: Sql;

    beforeAll(async () => {
      sql = postgres(databaseUrl!, { max: 1, ssl: false });
      await sql.unsafe("TRUNCATE TABLE institutions, budget_goals, digests CASCADE");
      const { seedDemoData } = await import("@/lib/demo/seed");
      await seedDemoData();
    });

    afterAll(async () => { await sql?.end(); });

    it("streams Ticker tool calls and the model follow-up through the chat route", async () => {
      const { POST } = await import("@/app/api/ai/chat/route");
      const response = await POST(new Request("http://localhost/api/ai/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ id: "chat-test", role: "user", parts: [{ type: "text", text: "What is my balance?" }] }] }),
      }));
      const stream = await response.text();
      expect(response.status).toBe(200);
      expect(stream).toContain("tool-output-available");
      expect(stream).toContain("Local model response received.");
      expect(fixture.requests.some((request) => request.model === "smoke-chat" && request.messages.some((message: { role: string }) => message.role === "tool"))).toBe(true);
    });

    it("streams planner calculations and a model follow-up through the planner route", async () => {
      const { POST } = await import("@/app/api/ai/budget-planner/route");
      const response = await POST(new Request("http://localhost/api/ai/budget-planner", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ id: "planner-test", role: "user", parts: [{ type: "text", text: "Save 1200 at 100 per month" }] }] }),
      }));
      const stream = await response.text();
      expect(response.status).toBe(200);
      expect(stream).toContain("tool-output-available");
      expect(stream).toContain("Your savings plan is ready.");
    });

    it.each(["true", "false"])("validates and persists three goals with structured outputs %s", async (structured) => {
      vi.stubEnv("AI_STRUCTURED_OUTPUTS", structured);
      const { POST } = await import("@/app/api/budget-goals/generate/route");
      const response = await POST(new Request("http://localhost/api/budget-goals/generate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tier: "balanced" }),
      }));
      expect(response.status).toBe(200);
      const [row] = await sql`SELECT count(*)::int AS count FROM budget_goals WHERE status = 'suggested'`;
      expect(row.count).toBe(3);
      expect(fixture.requests.at(-1).response_format.type).toBe(structured === "true" ? "json_schema" : "json_object");
      const recurringNames = await sql`SELECT name FROM recurring_items WHERE is_active = true ORDER BY name LIMIT 8`;
      expect(recurringNames.length).toBeGreaterThan(0);
      const prompt = JSON.stringify(fixture.requests.at(-1).messages);
      expect(prompt).toContain("Merchant-");
      for (const item of recurringNames) expect(prompt).not.toContain(item.name);
    });

    it("generates a real PDF using the local report model", async () => {
      const { POST } = await import("@/app/api/ai/report/route");
      const response = await POST(new Request("http://localhost/api/ai/report", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: "2026-01-01", to: "2026-12-31" }),
      }));
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/pdf");
      expect(Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
      expect(fixture.requests.at(-1).model).toBe("smoke-report");
      const merchants = await sql`
        SELECT merchant_name FROM transactions
        WHERE merchant_name IS NOT NULL AND amount > 0 AND pending = false
          AND date >= '2026-01-01' AND date <= '2026-12-31'
        GROUP BY merchant_name ORDER BY sum(amount) DESC LIMIT 6
      `;
      expect(merchants.length).toBeGreaterThan(0);
      const prompt = JSON.stringify(fixture.requests.at(-1).messages);
      expect(prompt).toContain("Merchant-");
      for (const merchant of merchants) expect(prompt).not.toContain(merchant.merchant_name);
    });

    it("generates and stores the weekly digest using its model override", async () => {
      const { generateWeeklyDigest, getLatestDigest } = await import("@/lib/digest/generate");
      const digest = await generateWeeklyDigest();
      expect(digest.summaryMarkdown).toContain("Weekly test digest");
      expect((await getLatestDigest())?.id).toBe(digest.id);
      expect(fixture.requests.at(-1).model).toBe("smoke-digest");
    });
  });
});
