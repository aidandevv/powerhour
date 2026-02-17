"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Pencil, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import type { BudgetGoalWithProgress } from "@/lib/ai/budget-goals";

interface Props {
  goal: BudgetGoalWithProgress;
  onAccept: () => void;
  onEdit: (monthlyTarget: number) => void;
  onDismiss: () => void;
}

const PROGRESS_COLORS: Record<BudgetGoalWithProgress["progressStatus"], string> = {
  on_track: "bg-emerald-500",
  at_risk: "bg-yellow-500",
  near_limit: "bg-orange-500",
  over_budget: "bg-red-500",
};

const PROGRESS_LABELS: Record<BudgetGoalWithProgress["progressStatus"], string> = {
  on_track: "On Track",
  at_risk: "At Risk",
  near_limit: "Near Limit",
  over_budget: "Over Budget",
};

const PROGRESS_BADGE_VARIANTS: Record<
  BudgetGoalWithProgress["progressStatus"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  on_track: "default",
  at_risk: "outline",
  near_limit: "outline",
  over_budget: "destructive",
};

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
  TRANSFER_IN: "⬇️",
  TRANSFER_OUT: "⬆️",
  LOAN_PAYMENTS: "💳",
};

function getCategoryEmoji(category: string): string {
  return CATEGORY_EMOJI[category] ?? "📊";
}

export function BudgetGoalCard({ goal, onAccept, onEdit, onDismiss }: Props) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [editValue, setEditValue] = React.useState(String(goal.monthlyTarget));

  const progressClamped = Math.min(goal.progressPercent, 100);
  const isAccepted = goal.status === "accepted";

  function handleEditSave() {
    const val = parseFloat(editValue);
    if (!isNaN(val) && val > 0) {
      onEdit(val);
      setEditOpen(false);
    }
  }

  return (
    <Card className="flex flex-col h-full">
      <CardContent className="flex flex-col gap-3 pt-5 h-full">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl leading-none">{getCategoryEmoji(goal.category)}</span>
            <span className="font-medium text-sm text-foreground truncate">
              {goal.categoryLabel}
            </span>
          </div>
          {isAccepted && (
            <Badge variant="default" className="shrink-0 text-xs">
              Accepted
            </Badge>
          )}
        </div>

        {/* Goal description */}
        <p className="text-sm text-foreground font-medium leading-snug">
          {goal.targetType === "cap" &&
            `Keep monthly ${goal.categoryLabel} under ${formatCurrency(goal.monthlyTarget)}`}
          {goal.targetType === "percent_reduction" &&
            `Reduce ${goal.categoryLabel} to ${formatCurrency(goal.monthlyTarget)}/mo`}
          {goal.targetType === "savings" &&
            `Save ${formatCurrency((goal.baselineMonthlySpend - goal.monthlyTarget) * 12)}/yr on ${goal.categoryLabel}`}
        </p>

        {/* Rationale */}
        <p className="text-xs text-muted-foreground leading-relaxed flex-1">{goal.rationale}</p>

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {formatCurrency(goal.currentSpend)} / {formatCurrency(goal.monthlyTarget)}/mo
            </span>
            <Badge
              variant={PROGRESS_BADGE_VARIANTS[goal.progressStatus]}
              className={cn(
                "text-xs",
                goal.progressStatus === "at_risk" && "border-yellow-500 text-yellow-600",
                goal.progressStatus === "near_limit" && "border-orange-500 text-orange-600"
              )}
            >
              {PROGRESS_LABELS[goal.progressStatus]}
            </Badge>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                PROGRESS_COLORS[goal.progressStatus]
              )}
              style={{ width: `${progressClamped}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground text-right">
            {goal.progressPercent}%
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 pt-1">
          {!isAccepted && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 gap-1.5 text-xs"
              onClick={onAccept}
            >
              <Check className="h-3 w-3" />
              Accept
            </Button>
          )}

          {/* Edit dialog */}
          <Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
            <Dialog.Trigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5 text-xs"
                onClick={() => setEditValue(String(goal.monthlyTarget))}
              >
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
            </Dialog.Trigger>

            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
              <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
                <Dialog.Title className="text-base font-semibold mb-1">
                  Edit Goal Target
                </Dialog.Title>
                <Dialog.Description className="text-sm text-muted-foreground mb-4">
                  Adjust your monthly target for {goal.categoryLabel}.
                </Dialog.Description>

                <div className="space-y-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      $
                    </span>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="pl-7"
                      onKeyDown={(e) => e.key === "Enter" && handleEditSave()}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={handleEditSave}>
                      Save
                    </Button>
                    <Dialog.Close asChild>
                      <Button variant="outline" className="flex-1">
                        Cancel
                      </Button>
                    </Dialog.Close>
                  </div>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          <Button
            size="sm"
            variant="ghost"
            className="flex-none gap-1.5 text-xs text-muted-foreground hover:text-destructive"
            onClick={onDismiss}
          >
            <X className="h-3 w-3" />
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
