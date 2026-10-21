"use client";

import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AI_FEATURE_LABELS, type AiStatus } from "@/lib/ai/features";
import type { AiFeature } from "@/lib/ai/model";

async function fetchStatus(url: string): Promise<AiStatus> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Unable to load AI provider status.");
  return response.json();
}

export function useAiStatus() {
  return useSWR<AiStatus>("/api/ai/status", fetchStatus, { revalidateOnFocus: false });
}

export function AiFeatureBadge({ feature, alwaysBeta = false }: {
  feature: AiFeature;
  alwaysBeta?: boolean;
}) {
  const { data } = useAiStatus();
  if (!data?.beta && !alwaysBeta) return null;

  return (
    <span
      aria-label={`${AI_FEATURE_LABELS[feature]}${data?.beta ? " with a local model" : ""} beta`}
      className="inline-flex shrink-0 items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
    >
      {data?.beta ? "Local model · Beta" : "Beta"}
    </span>
  );
}

export function AiProviderSettings() {
  const { data, error } = useAiStatus();

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI models</CardTitle>
        <CardDescription>
          {data?.beta
            ? "Local models are in beta. Responses can take longer and tool support varies by model."
            : "View the provider and models used by your AI features."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p role="alert">Unable to load AI provider status.</p> : !data ? (
          <p className="text-sm text-muted-foreground">Loading AI models…</p>
        ) : (
          <>
            <p className="text-sm font-medium">
              {data.beta ? "Local / OpenAI-compatible · Beta" : "Google Gemini"}
            </p>
            <dl className="space-y-3">
              {(Object.entries(AI_FEATURE_LABELS) as [AiFeature, string][]).map(([feature, label]) => (
                <div key={feature} className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <dt className="flex items-center gap-2 text-sm">
                    {label} <AiFeatureBadge feature={feature} />
                  </dt>
                  <dd className="break-all text-sm text-muted-foreground">
                    {data.features[feature].configured ? data.features[feature].modelId : "Setup required"}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground">
              Models are configured by the server administrator. Configuration status does not check whether the model server is reachable.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
