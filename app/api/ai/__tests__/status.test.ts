import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../status/route";

afterEach(() => vi.unstubAllEnvs());

describe("AI provider display status", () => {
  it("marks every local-model feature beta without exposing credentials or endpoint", async () => {
    vi.stubEnv("AI_PROVIDER", "openai-compatible");
    vi.stubEnv("AI_MODEL", "test-model");
    vi.stubEnv("AI_MODEL_REPORT", "report-model");
    vi.stubEnv("AI_BASE_URL", "http://127.0.0.1:11434/v1");
    vi.stubEnv("AI_API_KEY", "private-test-key");
    const response = GET();
    const data = await response.json();

    expect(data).toMatchObject({ provider: "openai-compatible", beta: true });
    expect(Object.keys(data.features).sort()).toEqual(["chat", "digest", "goals", "planner", "report"]);
    expect(data.features.report).toEqual({ modelId: "report-model", configured: true });
    expect(JSON.stringify(data)).not.toMatch(/private-test-key|127\.0\.0\.1|AI_API_KEY/);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("keeps local features beta even when setup is incomplete", async () => {
    vi.stubEnv("AI_PROVIDER", "openai-compatible");
    vi.stubEnv("AI_MODEL", "");
    vi.stubEnv("AI_BASE_URL", "");
    const data = await GET().json();
    expect(data.beta).toBe(true);
    expect(data.features.chat).toEqual({ modelId: null, configured: false });
  });

  it("exposes the Gemini pin for every hosted feature and reports missing setup honestly", async () => {
    vi.stubEnv("AI_PROVIDER", "google");
    vi.stubEnv("AI_MODEL", "");
    for (const feature of ["CHAT", "PLANNER", "REPORT", "GOALS", "DIGEST"]) {
      vi.stubEnv(`AI_MODEL_${feature}`, "");
    }
    vi.stubEnv("GEMINI_API_KEY", "");
    const data = await GET().json();
    expect(data.beta).toBe(false);
    expect(Object.keys(data.features)).toHaveLength(5);
    for (const feature of Object.values(data.features)) {
      expect(feature).toEqual({ modelId: "gemini-3.5-flash-lite", configured: false });
    }
  });

  it("does not reflect invalid provider input", async () => {
    vi.stubEnv("AI_PROVIDER", "invalid-private-value");
    const response = GET();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("invalid-private-value");
  });
});
