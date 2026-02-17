"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { mutate } from "swr";
import {
  Check,
  Pencil,
  Trash2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import type { BudgetGoalWithProgress } from "@/lib/ai/budget-goals";

const GOALS_KEY = "/api/budget-goals";

// ── Category helpers ───────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  FOOD_AND_DRINK: "🍽️",
  TRAVEL: "✈️",
  TRANSPORTATION: "🚗",
  SHOPPING: "🛍️",
  ENTERTAINMENT: "🎬",
  HEALTH: "🏥",
  PERSONAL_CARE: "💆",
  HOME: "🏠",
  UTILITIES: "💡",
  SUBSCRIPTIONS: "📱",
  RENT_AND_UTILITIES: "🏠",
  GENERAL_MERCHANDISE: "🛒",
  GENERAL_SERVICES: "⚙️",
  GOVERNMENT_AND_NON_PROFIT: "🏛️",
  INCOME: "💰",
  LOAN_PAYMENTS: "💳",
};

function getEmoji(cat: string) {
  return CATEGORY_EMOJI[cat] ?? "📊";
}

const STATUS_CONFIG: Record<
  BudgetGoalWithProgress["progressStatus"],
  { label: string; barColor: string; badgeClass: string }
> = {
  on_track:   { label: "On Track",    barColor: "bg-emerald-500", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800" },
  at_risk:    { label: "At Risk",     barColor: "bg-yellow-500",  badgeClass: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-400 dark:border-yellow-800" },
  near_limit: { label: "Near Limit",  barColor: "bg-orange-500",  badgeClass: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800" },
  over_budget:{ label: "Over Budget", barColor: "bg-red-500",     badgeClass: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800" },
};

function TrendIcon({ pct }: { pct: number }) {
  if (pct >= 100) return <TrendingUp className="h-3.5 w-3.5 text-red-500" />;
  if (pct >= 70)  return <TrendingUp className="h-3.5 w-3.5 text-orange-500" />;
  if (pct >= 40)  return <Minus className="h-3.5 w-3.5 text-yellow-500" />;
  return <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />;
}

// ── Goal row ───────────────────────────────────────────────────────────────────

function GoalRow({
  goal,
  onAccept,
  onEdit,
  onDismiss,
}: {
  goal: BudgetGoalWithProgress;
  onAccept: () => void;
  onEdit: (v: number) => void;
  onDismiss: () => void;
}) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [editValue, setEditValue] = React.useState(String(goal.monthlyTarget));
  const [expanded, setExpanded] = React.useState(false);

  const clamped = Math.min(goal.progressPercent, 100);
  const cfg = STATUS_CONFIG[goal.progressStatus];
  const isAccepted = goal.status === "accepted";

  function saveEdit() {
    const v = parseFloat(editValue);
    if (!isNaN(v) && v > 0) { onEdit(v); setEditOpen(false); }
  }

  const goalDescription =
    goal.targetType === "cap"
      ? `Keep monthly ${goal.categoryLabel} under ${formatCurrency(goal.monthlyTarget)}`
      : goal.targetType === "percent_reduction"
      ? `Reduce ${goal.categoryLabel} spend to ${formatCurrency(goal.monthlyTarget)}/mo`
      : `Save ${formatCurrency((goal.baselineMonthlySpend - goal.monthlyTarget) * 12)}/yr on ${goal.categoryLabel}`;

  return (
    <div className={cn(
      "rounded-xl border border-border bg-card transition-shadow",
      isAccepted ? "border-primary/30 shadow-sm" : ""
    )}>
      {/* Main row */}
      <div className="flex items-start gap-4 px-5 py-4">
        {/* Emoji */}
        <span className="text-2xl leading-none mt-0.5 shrink-0">{getEmoji(goal.category)}</span>

        {/* Category + description */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-foreground">{goal.categoryLabel}</span>
            {isAccepted && (
              <Badge className="text-xs px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                Active
              </Badge>
            )}
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full border font-medium",
              cfg.badgeClass
            )}>
              {cfg.label}
            </span>
          </div>

          <p className="text-xs text-muted-foreground leading-snug">{goalDescription}</p>

          {/* Progress */}
          <div className="pt-1 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <TrendIcon pct={goal.progressPercent} />
                <span>
                  {formatCurrency(goal.currentSpend)}
                  <span className="text-muted-foreground/60 mx-1">/</span>
                  {formatCurrency(goal.monthlyTarget)}
                </span>
              </div>
              <span className="tabular-nums">{goal.progressPercent}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", cfg.barColor)}
                style={{ width: `${clamped}%` }}
              />
            </div>
          </div>

          {/* Expandable rationale */}
          <button
            onClick={() => setExpanded((x) => !x)}
            className="text-xs text-muted-foreground/70 hover:text-muted-foreground mt-0.5 underline-offset-2 hover:underline transition-colors"
          >
            {expanded ? "Hide details ↑" : "Why this goal? ↓"}
          </button>
          {expanded && (
            <p className="text-xs text-muted-foreground leading-relaxed bg-muted/40 rounded-lg px-3 py-2 mt-1">
              {goal.rationale}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          {!isAccepted && (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-emerald-600" onClick={onAccept} title="Accept goal">
              <Check className="h-3.5 w-3.5" />
            </Button>
          )}

          <Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
            <Dialog.Trigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setEditValue(String(goal.monthlyTarget))}
                title="Edit target"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
              <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
                <Dialog.Title className="text-base font-semibold mb-1">Edit Monthly Target</Dialog.Title>
                <Dialog.Description className="text-sm text-muted-foreground mb-4">
                  Adjust the monthly spending target for {goal.categoryLabel}.
                </Dialog.Description>
                <div className="space-y-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="pl-7"
                      onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Current baseline: {formatCurrency(goal.baselineMonthlySpend)}/mo
                  </p>
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={saveEdit}>Save</Button>
                    <Dialog.Close asChild>
                      <Button variant="outline" className="flex-1">Cancel</Button>
                    </Dialog.Close>
                  </div>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={onDismiss}
            title="Dismiss goal"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── ManageGoals ────────────────────────────────────────────────────────────────

interface ManageGoalsProps {
  goals: BudgetGoalWithProgress[];
  lastGeneratedAt: string | null;
  generating: boolean;
  generateError: string | null;
  onReanalyze: () => void;
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ManageGoals({
  goals,
  lastGeneratedAt,
  generating,
  generateError,
  onReanalyze,
}: ManageGoalsProps) {
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

  const acceptedCount = goals.filter((g) => g.status === "accepted").length;
  const overBudgetCount = goals.filter((g) => g.progressStatus === "over_budget").length;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{goals.length}</span> goals
            {acceptedCount > 0 && (
              <> · <span className="text-primary font-medium">{acceptedCount} active</span></>
            )}
            {overBudgetCount > 0 && (
              <> · <span className="text-destructive font-medium">{overBudgetCount} over budget</span></>
            )}
          </span>
          {lastGeneratedAt && (
            <span className="hidden sm:inline text-xs">
              Updated {formatTimeAgo(lastGeneratedAt)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onReanalyze}
            disabled={generating}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={cn("h-3 w-3", generating && "animate-spin")} />
            {generating ? "Analyzing…" : "Re-analyze"}
          </Button>
        </div>
      </div>

      {/* Error */}
      {generateError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center justify-between">
          <span>{generateError}</span>
          <button className="text-xs underline ml-4 shrink-0" onClick={onReanalyze}>Retry</button>
        </div>
      )}

      {/* Generating overlay */}
      {generating && (
        <div className="rounded-xl border border-border bg-card/60 px-6 py-10 text-center text-sm text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
          Analyzing 3 months of spending…
        </div>
      )}

      {/* Goals list */}
      {!generating && (
        <div className="space-y-3">
          {goals.length === 0 && (
            <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
              All goals dismissed. Click Re-analyze or Start Over to generate new ones.
            </div>
          )}
          {goals.map((goal) => (
            <GoalRow
              key={goal.id}
              goal={goal}
              onAccept={() => handleAccept(goal.id)}
              onEdit={(v) => handleEdit(goal.id, v)}
              onDismiss={() => handleDismiss(goal.id)}
            />
          ))}
        </div>
      )}

      {/* Legend */}
      {!generating && goals.length > 0 && (
        <p className="text-xs text-muted-foreground text-center pt-2">
          Accept a goal to mark it active · Edit to adjust the target · Dismiss to remove
        </p>
      )}
    </div>
  );
}
