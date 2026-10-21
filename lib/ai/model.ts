/**
 * Language model factory.
 *
 * Every AI call site resolves its model here so the provider can be switched
 * with environment variables:
 *
 *   AI_PROVIDER   google (default) | openai-compatible
 *   AI_MODEL      model id; defaults to gemini-2.5-flash-lite for google
 *   AI_MODEL_<FEATURE>  per-feature override (CHAT, PLANNER, DIGEST, REPORT, GOALS)
 *   AI_BASE_URL   OpenAI-compatible endpoint, e.g. http://localhost:11434/v1
 *   AI_API_KEY    optional bearer token for the OpenAI-compatible endpoint
 *   AI_STRUCTURED_OUTPUTS  "false" to disable json_schema response formats
 *
 * Timeouts and agent step limits are configurable per feature because local
 * models process prompts much more slowly than hosted ones.
 *
 * Resolution is lazy (at call time, not module load) so `next build` and
 * tests do not need provider credentials.
 */
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

export type AiProvider = "google" | "openai-compatible";
export type AiFeature = "chat" | "planner" | "digest" | "report" | "goals";
export type AgentFeature = Extract<AiFeature, "chat" | "planner">;

type Env = Record<string, string | undefined>;

export const DEFAULT_GOOGLE_MODEL = "gemini-2.5-flash-lite";

const PROVIDERS: readonly AiProvider[] = ["google", "openai-compatible"];

/** Defaults match the behavior tuned for Gemini 2.5 Flash Lite. */
const DEFAULT_TIMEOUT_MS: Record<AiFeature, number> = {
  chat: 90_000,
  planner: 120_000,
  digest: 30_000,
  report: 15_000,
  goals: 30_000,
};

const LOCAL_TIMEOUT_MS: Record<AiFeature, number> = {
  chat: 300_000,
  planner: 600_000,
  digest: 180_000,
  report: 180_000,
  goals: 180_000,
};

const DEFAULT_MAX_STEPS: Record<AgentFeature, number> = {
  chat: 8,
  planner: 16,
};

export interface AiModelConfig {
  provider: AiProvider;
  modelId: string;
  baseURL?: string;
}

export interface AgentLimits {
  maxSteps: number;
  timeoutMs: number;
}

function read(env: Env, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

function readPositiveInt(env: Env, key: string, fallback: number): number {
  const raw = read(env, key);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer, got "${raw}"`);
  }
  return parsed;
}

export function resolveProvider(env: Env = process.env): AiProvider {
  const raw = read(env, "AI_PROVIDER")?.toLowerCase() ?? "google";
  if (!(PROVIDERS as readonly string[]).includes(raw)) {
    throw new Error(
      `AI_PROVIDER must be one of ${PROVIDERS.join(", ")}, got "${raw}"`
    );
  }
  return raw as AiProvider;
}

/** Resolve provider, model id, and endpoint for a feature without creating a client. */
export function resolveAiConfig(
  feature: AiFeature,
  env: Env = process.env
): AiModelConfig {
  const provider = resolveProvider(env);
  const override = read(env, `AI_MODEL_${feature.toUpperCase()}`);
  const shared = read(env, "AI_MODEL");

  if (provider === "google") {
    return { provider, modelId: override ?? shared ?? DEFAULT_GOOGLE_MODEL };
  }

  const modelId = override ?? shared;
  if (!modelId) {
    throw new Error(
      `AI_MODEL (or AI_MODEL_${feature.toUpperCase()}) is required when AI_PROVIDER=openai-compatible`
    );
  }

  const baseURL = read(env, "AI_BASE_URL");
  if (!baseURL) {
    throw new Error(
      "AI_BASE_URL is required when AI_PROVIDER=openai-compatible (e.g. http://localhost:11434/v1)"
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(baseURL);
  } catch {
    throw new Error(`AI_BASE_URL is not a valid URL: "${baseURL}"`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("AI_BASE_URL must use http or https");
  }

  return { provider, modelId, baseURL: baseURL.replace(/\/+$/, "") };
}

/** Return the AI SDK language model configured for a feature. */
export function getLanguageModel(
  feature: AiFeature,
  env: Env = process.env
): LanguageModel {
  const config = resolveAiConfig(feature, env);

  if (config.provider === "google") {
    const apiKey = read(env, "GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required when AI_PROVIDER=google");
    }
    return createGoogleGenerativeAI({ apiKey })(config.modelId);
  }

  const provider = createOpenAICompatible({
    name: "openai-compatible",
    baseURL: config.baseURL!,
    apiKey: read(env, "AI_API_KEY"),
    includeUsage: true,
    supportsStructuredOutputs: read(env, "AI_STRUCTURED_OUTPUTS") !== "false",
  });
  return provider.chatModel(config.modelId);
}

/** Request timeout for a feature, from AI_<FEATURE>_TIMEOUT_MS. */
export function getAiTimeoutMs(
  feature: AiFeature,
  env: Env = process.env
): number {
  return readPositiveInt(
    env,
    `AI_${feature.toUpperCase()}_TIMEOUT_MS`,
    resolveProvider(env) === "openai-compatible" ? LOCAL_TIMEOUT_MS[feature] : DEFAULT_TIMEOUT_MS[feature]
  );
}

/** Step cap and timeout for an agent loop, from AI_<FEATURE>_MAX_STEPS / _TIMEOUT_MS. */
export function getAgentLimits(
  feature: AgentFeature,
  env: Env = process.env
): AgentLimits {
  return {
    maxSteps: readPositiveInt(
      env,
      `AI_${feature.toUpperCase()}_MAX_STEPS`,
      DEFAULT_MAX_STEPS[feature]
    ),
    timeoutMs: getAiTimeoutMs(feature, env),
  };
}
