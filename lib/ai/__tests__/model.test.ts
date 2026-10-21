import { beforeEach, describe, expect, it, vi } from "vitest";

const { googleFactoryMock, googleModelMock, openaiCompatibleFactoryMock, chatModelMock } =
  vi.hoisted(() => {
    const googleModelMock = vi.fn((id: string) => ({ provider: "google", id }));
    const chatModelMock = vi.fn((id: string) => ({ provider: "openai-compatible", id }));
    return {
      googleModelMock,
      googleFactoryMock: vi.fn(() => googleModelMock),
      chatModelMock,
      openaiCompatibleFactoryMock: vi.fn(() => ({ chatModel: chatModelMock })),
    };
  });

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: googleFactoryMock,
}));

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: openaiCompatibleFactoryMock,
}));

import {
  DEFAULT_GOOGLE_MODEL,
  getAgentLimits,
  getAiTimeoutMs,
  getLanguageModel,
  resolveAiConfig,
  resolveProvider,
} from "../model";

const LOCAL = {
  AI_PROVIDER: "openai-compatible",
  AI_BASE_URL: "http://localhost:11434/v1",
  AI_MODEL: "qwen3:8b",
};

describe("resolveProvider", () => {
  it("defaults to google", () => {
    expect(resolveProvider({})).toBe("google");
    expect(resolveProvider({ AI_PROVIDER: "  " })).toBe("google");
  });

  it("accepts openai-compatible case-insensitively", () => {
    expect(resolveProvider({ AI_PROVIDER: "OpenAI-Compatible" })).toBe("openai-compatible");
  });

  it("rejects unknown providers", () => {
    expect(() => resolveProvider({ AI_PROVIDER: "ollama" })).toThrow(/AI_PROVIDER must be one of/);
  });
});

describe("resolveAiConfig", () => {
  it("defaults to gemini-2.5-flash-lite on google", () => {
    expect(resolveAiConfig("chat", {})).toEqual({
      provider: "google",
      modelId: DEFAULT_GOOGLE_MODEL,
    });
    expect(DEFAULT_GOOGLE_MODEL).toBe("gemini-2.5-flash-lite");
  });

  it("uses AI_MODEL on google when set", () => {
    expect(resolveAiConfig("digest", { AI_MODEL: "gemini-2.5-flash" }).modelId).toBe(
      "gemini-2.5-flash"
    );
  });

  it("prefers per-feature overrides over AI_MODEL", () => {
    const env = { ...LOCAL, AI_MODEL_CHAT: "qwen3:14b", AI_MODEL_GOALS: "llama3.1:8b" };
    expect(resolveAiConfig("chat", env).modelId).toBe("qwen3:14b");
    expect(resolveAiConfig("goals", env).modelId).toBe("llama3.1:8b");
    expect(resolveAiConfig("planner", env).modelId).toBe("qwen3:8b");
    expect(resolveAiConfig("digest", env).modelId).toBe("qwen3:8b");
    expect(resolveAiConfig("report", env).modelId).toBe("qwen3:8b");
  });

  it("returns base URL without trailing slashes", () => {
    expect(resolveAiConfig("chat", { ...LOCAL, AI_BASE_URL: "http://host.docker.internal:11434/v1/" }))
      .toEqual({
        provider: "openai-compatible",
        modelId: "qwen3:8b",
        baseURL: "http://host.docker.internal:11434/v1",
      });
  });

  it("requires a model id for openai-compatible", () => {
    expect(() =>
      resolveAiConfig("report", { AI_PROVIDER: "openai-compatible", AI_BASE_URL: LOCAL.AI_BASE_URL })
    ).toThrow(/AI_MODEL \(or AI_MODEL_REPORT\) is required/);
  });

  it("accepts a per-feature model without AI_MODEL", () => {
    expect(
      resolveAiConfig("report", {
        AI_PROVIDER: "openai-compatible",
        AI_BASE_URL: LOCAL.AI_BASE_URL,
        AI_MODEL_REPORT: "mistral-nemo",
      }).modelId
    ).toBe("mistral-nemo");
  });

  it("requires a valid http(s) base URL for openai-compatible", () => {
    expect(() => resolveAiConfig("chat", { ...LOCAL, AI_BASE_URL: undefined })).toThrow(
      /AI_BASE_URL is required/
    );
    expect(() => resolveAiConfig("chat", { ...LOCAL, AI_BASE_URL: "not a url" })).toThrow(
      /not a valid URL/
    );
    expect(() => resolveAiConfig("chat", { ...LOCAL, AI_BASE_URL: "file:///etc/passwd" })).toThrow(
      /must use http or https/
    );
  });
});

describe("getLanguageModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds a Gemini model by default", () => {
    const model = getLanguageModel("chat", { GEMINI_API_KEY: "test-key" });
    expect(googleFactoryMock).toHaveBeenCalledWith({ apiKey: "test-key" });
    expect(googleModelMock).toHaveBeenCalledWith("gemini-2.5-flash-lite");
    expect(model).toEqual({ provider: "google", id: "gemini-2.5-flash-lite" });
    expect(openaiCompatibleFactoryMock).not.toHaveBeenCalled();
  });

  it("requires GEMINI_API_KEY only for google", () => {
    expect(() => getLanguageModel("chat", {})).toThrow(/GEMINI_API_KEY is required/);
    expect(() => getLanguageModel("chat", LOCAL)).not.toThrow();
  });

  it("builds an OpenAI-compatible chat model", () => {
    const model = getLanguageModel("planner", { ...LOCAL, AI_MODEL_PLANNER: "qwen3:14b" });
    expect(openaiCompatibleFactoryMock).toHaveBeenCalledWith({
      name: "openai-compatible",
      baseURL: "http://localhost:11434/v1",
      apiKey: undefined,
      includeUsage: true,
      supportsStructuredOutputs: true,
    });
    expect(chatModelMock).toHaveBeenCalledWith("qwen3:14b");
    expect(model).toEqual({ provider: "openai-compatible", id: "qwen3:14b" });
    expect(googleFactoryMock).not.toHaveBeenCalled();
  });

  it("passes AI_API_KEY and AI_STRUCTURED_OUTPUTS through", () => {
    getLanguageModel("goals", { ...LOCAL, AI_API_KEY: "local-key", AI_STRUCTURED_OUTPUTS: "false" });
    expect(openaiCompatibleFactoryMock).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "local-key", supportsStructuredOutputs: false })
    );
  });
});

describe("timeouts and step limits", () => {
  it("keeps current defaults", () => {
    expect(getAgentLimits("chat", {})).toEqual({ maxSteps: 8, timeoutMs: 90_000 });
    expect(getAgentLimits("planner", {})).toEqual({ maxSteps: 16, timeoutMs: 120_000 });
    expect(getAiTimeoutMs("digest", {})).toBe(30_000);
    expect(getAiTimeoutMs("report", {})).toBe(15_000);
    expect(getAiTimeoutMs("goals", {})).toBe(30_000);
  });

  it("reads per-feature overrides", () => {
    const env = {
      AI_CHAT_MAX_STEPS: "12",
      AI_CHAT_TIMEOUT_MS: "300000",
      AI_PLANNER_MAX_STEPS: "20",
      AI_REPORT_TIMEOUT_MS: "120000",
    };
    expect(getAgentLimits("chat", env)).toEqual({ maxSteps: 12, timeoutMs: 300_000 });
    expect(getAgentLimits("planner", env)).toEqual({ maxSteps: 20, timeoutMs: 120_000 });
    expect(getAiTimeoutMs("report", env)).toBe(120_000);
  });

  it("allows slower local inference by default while preserving explicit limits", () => {
    expect(getAgentLimits("chat", LOCAL)).toEqual({ maxSteps: 8, timeoutMs: 300_000 });
    expect(getAgentLimits("planner", LOCAL)).toEqual({ maxSteps: 16, timeoutMs: 600_000 });
    for (const feature of ["digest", "report", "goals"] as const) {
      expect(getAiTimeoutMs(feature, LOCAL)).toBe(180_000);
    }
    expect(getAiTimeoutMs("report", { ...LOCAL, AI_REPORT_TIMEOUT_MS: "60000" })).toBe(60_000);
  });

  it("rejects non-positive or non-integer values", () => {
    expect(() => getAgentLimits("chat", { AI_CHAT_MAX_STEPS: "0" })).toThrow(
      /AI_CHAT_MAX_STEPS must be a positive integer/
    );
    expect(() => getAiTimeoutMs("digest", { AI_DIGEST_TIMEOUT_MS: "1.5" })).toThrow(
      /AI_DIGEST_TIMEOUT_MS must be a positive integer/
    );
    expect(() => getAiTimeoutMs("goals", { AI_GOALS_TIMEOUT_MS: "soon" })).toThrow(
      /AI_GOALS_TIMEOUT_MS must be a positive integer/
    );
  });
});
