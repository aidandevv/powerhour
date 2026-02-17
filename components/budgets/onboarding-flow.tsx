"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronRight, Zap, Scale, Coffee, Check } from "lucide-react";
import type { BudgetTier, BudgetProfile } from "@/lib/ai/budget-goals";

// ── Category options ───────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "FOOD_AND_DRINK", label: "Food & Dining", emoji: "🍽️" },
  { id: "ENTERTAINMENT", label: "Entertainment", emoji: "🎬" },
  { id: "SHOPPING", label: "Shopping", emoji: "🛍️" },
  { id: "GENERAL_MERCHANDISE", label: "General Shopping", emoji: "🛒" },
  { id: "TRANSPORTATION", label: "Transportation", emoji: "🚗" },
  { id: "TRAVEL", label: "Travel", emoji: "✈️" },
  { id: "PERSONAL_CARE", label: "Personal Care", emoji: "💆" },
  { id: "SUBSCRIPTIONS", label: "Subscriptions", emoji: "📱" },
  { id: "HEALTH", label: "Health & Fitness", emoji: "🏥" },
  { id: "HOME", label: "Home & Garden", emoji: "🏠" },
];

// ── Tier config ────────────────────────────────────────────────────────────────

const TIERS: {
  id: BudgetTier;
  label: string;
  tagline: string;
  description: string;
  icon: React.ElementType;
  color: string;
  ring: string;
  bg: string;
  textColor: string;
}[] = [
  {
    id: "aggressive",
    label: "Aggressive",
    tagline: "Maximum savings mode",
    description: "Tight caps. 20–35% cuts on discretionary spend. For when you're serious about change.",
    icon: Zap,
    color: "text-red-500",
    ring: "ring-red-500",
    bg: "bg-red-50 dark:bg-red-950/30",
    textColor: "text-red-700 dark:text-red-400",
  },
  {
    id: "balanced",
    label: "Balanced",
    tagline: "Stretch without the pain",
    description: "10–20% reductions. Real savings while keeping your lifestyle mostly intact.",
    icon: Scale,
    color: "text-blue-500",
    ring: "ring-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    textColor: "text-blue-700 dark:text-blue-400",
  },
  {
    id: "casual",
    label: "Casual",
    tagline: "Awareness over sacrifice",
    description: "Gentle 5–10% nudges. Just want visibility and small wins without friction.",
    icon: Coffee,
    color: "text-emerald-500",
    ring: "ring-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    textColor: "text-emerald-700 dark:text-emerald-400",
  },
];

// ── Props ──────────────────────────────────────────────────────────────────────

interface OnboardingFlowProps {
  onComplete: (profile: BudgetProfile) => void;
  isGenerating: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function OnboardingFlow({ onComplete, isGenerating }: OnboardingFlowProps) {
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [tier, setTier] = React.useState<BudgetTier | null>(null);
  const [income, setIncome] = React.useState("");
  const [priorities, setPriorities] = React.useState<string[]>([]);
  const [savingsTarget, setSavingsTarget] = React.useState("");
  const [upcomingExpenses, setUpcomingExpenses] = React.useState("");

  function toggleCategory(id: string) {
    setPriorities((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  function handleStep1Next() {
    if (tier) setStep(2);
  }

  function handleStep2Next() {
    setStep(3);
  }

  function handleGenerate() {
    if (!tier) return;
    const profile: BudgetProfile = {
      tier,
      monthlyIncome: income ? parseFloat(income) : undefined,
      priorityCategories: priorities.length ? priorities : undefined,
      monthlySavingsTarget: savingsTarget ? parseFloat(savingsTarget) : undefined,
      upcomingExpenses: upcomingExpenses.trim() || undefined,
    };
    onComplete(profile);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {([1, 2, 3] as const).map((s) => (
          <React.Fragment key={s}>
            <div
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                s === step ? "w-8 bg-primary" : s < step ? "w-4 bg-primary/40" : "w-4 bg-muted"
              )}
            />
          </React.Fragment>
        ))}
        <span className="text-xs text-muted-foreground ml-2">Step {step} of 3</span>
      </div>

      {/* ── Step 1: Choose tier ── */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Pick your budget style</h2>
            <p className="text-sm text-muted-foreground mt-1">
              This shapes how aggressive the AI sets your spending targets.
            </p>
          </div>

          <div className="space-y-3">
            {TIERS.map((t) => {
              const Icon = t.icon;
              const selected = tier === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTier(t.id)}
                  className={cn(
                    "w-full text-left rounded-xl border-2 px-5 py-4 transition-all duration-150",
                    "flex items-start gap-4",
                    selected
                      ? `border-primary ${t.bg} ring-2 ${t.ring} ring-offset-1`
                      : "border-border bg-card hover:border-primary/40 hover:bg-accent/30"
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 h-9 w-9 rounded-full flex items-center justify-center shrink-0",
                      selected ? t.bg : "bg-muted"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", selected ? t.color : "text-muted-foreground")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm">{t.label}</span>
                      <span className={cn("text-xs font-medium", selected ? t.textColor : "text-muted-foreground")}>
                        {t.tagline}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {t.description}
                    </p>
                  </div>
                  {selected && (
                    <Check className="h-4 w-4 text-primary shrink-0 mt-1" />
                  )}
                </button>
              );
            })}
          </div>

          <Button
            onClick={handleStep1Next}
            disabled={!tier}
            className="w-full gap-2"
          >
            Continue
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ── Step 2: Questions ── */}
      {step === 2 && (
        <div className="space-y-7">
          <div>
            <h2 className="text-xl font-semibold text-foreground">A few quick questions</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Skip anything you&apos;d rather not share — the AI will work with what it has.
            </p>
          </div>

          {/* Monthly income */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Monthly take-home income
              <span className="ml-1.5 text-xs text-muted-foreground font-normal">(after tax)</span>
            </label>
            <div className="relative max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                type="number"
                min={0}
                step={100}
                placeholder="e.g. 5000"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>

          {/* Priority categories */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Categories you most want to improve
              <span className="ml-1.5 text-xs text-muted-foreground font-normal">(pick any)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const selected = priorities.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleCategory(cat.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
                      selected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                    )}
                  >
                    <span>{cat.emoji}</span>
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Monthly savings target */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Monthly savings target
              <span className="ml-1.5 text-xs text-muted-foreground font-normal">(optional)</span>
            </label>
            <div className="relative max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                type="number"
                min={0}
                step={50}
                placeholder="e.g. 500"
                value={savingsTarget}
                onChange={(e) => setSavingsTarget(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>

          {/* Upcoming expenses */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Any big upcoming expenses?
              <span className="ml-1.5 text-xs text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              placeholder="e.g. Europe trip in June, new laptop"
              value={upcomingExpenses}
              onChange={(e) => setUpcomingExpenses(e.target.value)}
              maxLength={300}
            />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="w-28">
              Back
            </Button>
            <Button onClick={handleStep2Next} className="flex-1 gap-2">
              Continue
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Confirm + generate ── */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Ready to generate your goals</h2>
            <p className="text-sm text-muted-foreground mt-1">
              The AI will analyze 3 months of your actual transactions and create 3 personalized goals.
            </p>
          </div>

          {/* Summary */}
          <div className="rounded-xl border border-border bg-card divide-y divide-border/60">
            {(() => {
              const t = TIERS.find((x) => x.id === tier)!;
              const Icon = t.icon;
              return (
                <div className="flex items-center gap-3 px-4 py-3">
                  <Icon className={cn("h-4 w-4 shrink-0", t.color)} />
                  <div>
                    <span className="text-sm font-medium text-foreground">{t.label} mode</span>
                    <p className="text-xs text-muted-foreground">{t.tagline}</p>
                  </div>
                </div>
              );
            })()}
            {income && (
              <div className="px-4 py-3 text-sm flex justify-between">
                <span className="text-muted-foreground">Monthly income</span>
                <span className="font-medium">${parseFloat(income).toLocaleString()}</span>
              </div>
            )}
            {priorities.length > 0 && (
              <div className="px-4 py-3 text-sm flex justify-between gap-4">
                <span className="text-muted-foreground shrink-0">Focus categories</span>
                <span className="font-medium text-right">
                  {priorities
                    .map((id) => CATEGORIES.find((c) => c.id === id)?.label ?? id)
                    .join(", ")}
                </span>
              </div>
            )}
            {savingsTarget && (
              <div className="px-4 py-3 text-sm flex justify-between">
                <span className="text-muted-foreground">Savings target</span>
                <span className="font-medium">${parseFloat(savingsTarget).toLocaleString()}/mo</span>
              </div>
            )}
            {upcomingExpenses && (
              <div className="px-4 py-3 text-sm flex justify-between gap-4">
                <span className="text-muted-foreground shrink-0">Upcoming</span>
                <span className="font-medium text-right">{upcomingExpenses}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)} className="w-28" disabled={isGenerating}>
              Back
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex-1 gap-2"
            >
              {isGenerating ? (
                <>
                  <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  Analyzing your spending…
                </>
              ) : (
                "Generate My Goals →"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
