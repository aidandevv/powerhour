"use client";

import * as React from "react";
import useSWR, { mutate } from "swr";
import { ChevronDown, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BudgetGoalCard } from "./budget-goal-card";
import type { BudgetGoalWithProgress } from "@/lib/ai/budget-goals";

interface GoalsResponse {
  goals: BudgetGoalWithProgress[];
  lastGeneratedAt: string | null;
}

const GOALS_KEY = "/api/budget-goals";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to fetch goals");
    return r.json() as Promise<GoalsResponse>;
  });

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-muted animate-pulse" />
          <div className="h-4 w-28 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-4 w-full rounded bg-muted animate-pulse" />
        <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
        <div className="space-y-1">
          <div className="h-3 w-full rounded bg-muted animate-pulse" />
          <div className="h-1.5 w-full rounded-full bg-muted animate-pulse" />
        </div>
        <div className="flex gap-1.5 pt-1">
          <div className="h-8 flex-1 rounded bg-muted animate-pulse" />
          <div className="h-8 flex-1 rounded bg-muted animate-pulse" />
          <div className="h-8 w-16 rounded bg-muted animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}

export function BudgetGoalsPanel() {
  const [isOpen, setIsOpen] = React.useState(false);
  const { data, error, isLoading } = useSWR<GoalsResponse>(
    GOALS_KEY,
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 30_000 }
  );
  const [generating, setGenerating] = React.useState(false);
  const [generateError, setGenerateError] = React.useState<string | null>(null);

  async function handleReanalyze() {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/budget-goals/generate", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Analysis failed");
      }
      await mutate(GOALS_KEY);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleAccept(id: string) {
    await fetch(`/api/budget-goals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "accepted" }),
    });
    await mutate(GOALS_KEY);
  }

  async function handleEdit(id: string, monthlyTarget: number) {
    await fetch(`/api/budget-goals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyTarget }),
    });
    await mutate(GOALS_KEY);
  }

  async function handleDismiss(id: string) {
    await fetch(`/api/budget-goals/${id}`, { method: "DELETE" });
    await mutate(GOALS_KEY);
  }

  const goals = data?.goals ?? [];
  const lastGenerated = data?.lastGeneratedAt ?? null;
  const hasGoals = goals.length > 0;
  const neverRun = !isLoading && !error && !hasGoals;

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      {/* Collapsed header — always visible */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-accent/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-tertiary" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Smart Budget Goals
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="px-5 pb-5 space-y-4 border-t border-border/60">
          {/* Re-analyze row */}
          <div className="flex items-center justify-end pt-4">
            {lastGenerated && (
              <span className="text-xs text-muted-foreground mr-3 hidden sm:inline">
                {formatTimeAgo(lastGenerated)}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleReanalyze}
              disabled={generating}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3 w-3 ${generating ? "animate-spin" : ""}`} />
              {generating ? "Analyzing…" : "Re-analyze"}
            </Button>
          </div>

          {/* Error from generate */}
          {generateError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center justify-between">
              <span>{generateError}</span>
              <button
                className="text-xs underline underline-offset-2 ml-4 shrink-0"
                onClick={handleReanalyze}
              >
                Retry
              </button>
            </div>
          )}

          {/* Fetch error */}
          {error && !generateError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              Failed to load budget goals.
            </div>
          )}

          {/* Loading skeletons */}
          {isLoading && (
            <div className="grid gap-4 lg:grid-cols-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )}

          {/* Generating spinner */}
          {generating && (
            <div className="rounded-xl border border-border bg-card/60 px-6 py-8 text-center text-sm text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-tertiary" />
              Analyzing 3 months of spending…
            </div>
          )}

          {/* Never run — CTA */}
          {neverRun && !generating && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-4 py-10 text-center">
                <Sparkles className="h-8 w-8 text-tertiary" />
                <div>
                  <p className="font-medium text-foreground">Analyze your spending to get AI budget goals</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    We&apos;ll study 3 months of transactions and create 3 personalized goals.
                  </p>
                </div>
                <Button onClick={handleReanalyze} disabled={generating} className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Get Budget Goals
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Goals grid */}
          {!isLoading && !generating && hasGoals && (
            <div className="grid gap-4 lg:grid-cols-3">
              {goals.map((goal) => (
                <BudgetGoalCard
                  key={goal.id}
                  goal={goal}
                  onAccept={() => handleAccept(goal.id)}
                  onEdit={(target) => handleEdit(goal.id, target)}
                  onDismiss={() => handleDismiss(goal.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
