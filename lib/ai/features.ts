import type { AiFeature, AiProvider } from "./model";

export const AI_FEATURE_LABELS: Record<AiFeature, string> = {
  chat: "Ticker",
  planner: "Budget Planner",
  report: "PDF reports",
  goals: "Smart budget goals",
  digest: "Weekly AI digest",
};

export interface AiStatus {
  provider: AiProvider;
  beta: boolean;
  features: Record<AiFeature, { modelId: string | null; configured: boolean }>;
}
