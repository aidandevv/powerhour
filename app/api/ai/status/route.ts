import { NextResponse } from "next/server";
import { AI_FEATURE_LABELS, type AiStatus } from "@/lib/ai/features";
import { resolveAiConfig, resolveProvider, type AiFeature } from "@/lib/ai/model";

export function GET() {
  try {
    const provider = resolveProvider();
    const features = Object.fromEntries(
      (Object.keys(AI_FEATURE_LABELS) as AiFeature[]).map((feature) => {
        try {
          const config = resolveAiConfig(feature);
          return [feature, {
            modelId: config.modelId,
            configured: provider !== "google" || Boolean(process.env.GEMINI_API_KEY?.trim()),
          }];
        } catch {
          return [feature, { modelId: null, configured: false }];
        }
      })
    ) as AiStatus["features"];

    // Only expose display metadata; endpoints and credentials stay server-side.
    return NextResponse.json(
      { provider, beta: provider === "openai-compatible", features } satisfies AiStatus,
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "AI provider configuration is invalid." }, { status: 500 });
  }
}
