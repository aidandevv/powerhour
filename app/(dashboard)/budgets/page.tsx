"use client";

import * as React from "react";
import useSWR, { mutate } from "swr";
import { Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnboardingFlow } from "@/components/budgets/onboarding-flow";
import { ManageGoals } from "@/components/budgets/manage-goals";
import type { BudgetGoalWithProgress } from "@/lib/ai/budget-goals";
import type { BudgetProfile } from "@/lib/ai/budget-goals";

interface GoalsResponse {
  goals: BudgetGoalWithProgress[];
  lastGeneratedAt: string | null;
}

const GOALS_KEY = "/api/budget-goals";
const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to fetch");
    return r.json() as Promise<GoalsResponse>;
  });

type View = "onboarding" | "manage";

export default function BudgetsPage() {
  const { data, isLoading } = useSWR<GoalsResponse>(GOALS_KEY, fetcher, {
    revalidateOnFocus: false,
  });

  const [view, setView] = React.useState<View | null>(null); // null = loading
  const [generating, setGenerating] = React.useState(false);
  const [generateError, setGenerateError] = React.useState<string | null>(null);

  // Once data loads, decide initial view
  React.useEffect(() => {
    if (data !== undefined && view === null) {
      setView(data.goals.length > 0 ? "manage" : "onboarding");
    }
  }, [data, view]);

  async function generate(profile?: BudgetProfile) {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/budget-goals/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile ?? {}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Analysis failed");
      }
      await mutate(GOALS_KEY);
      setView("manage");
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleOnboardingComplete(profile: BudgetProfile) {
    await generate(profile);
  }

  async function handleReanalyze() {
    await generate();
  }

  function handleStartOver() {
    setView("onboarding");
    setGenerateError(null);
  }

  const goals = data?.goals ?? [];
  const lastGeneratedAt = data?.lastGeneratedAt ?? null;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground tracking-tight">
              Smart Budgets
            </h1>
            <p className="text-sm text-muted-foreground">
              AI-generated spending goals based on your transaction history
            </p>
          </div>
        </div>

        {view === "manage" && (
          <Button onClick={handleStartOver} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            New Budget
          </Button>
        )}
      </div>

      {/* Content */}
      {(isLoading && view === null) ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          <span className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin mr-2" />
          Loading…
        </div>
      ) : view === "onboarding" ? (
        <div className="rounded-2xl border border-border bg-card">
          <OnboardingFlow
            onComplete={handleOnboardingComplete}
            isGenerating={generating}
          />
          {generateError && (
            <div className="px-4 pb-6 text-center text-sm text-destructive">
              {generateError}
            </div>
          )}
        </div>
      ) : (
        <ManageGoals
          goals={goals}
          lastGeneratedAt={lastGeneratedAt}
          generating={generating}
          generateError={generateError}
          onReanalyze={handleReanalyze}
        />
      )}
    </div>
  );
}
