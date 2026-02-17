"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import { PlannerChat } from "@/components/budget-planner/planner-chat";
import { TrackActualExpensesButton } from "@/components/budget-planner/track-actual-expenses-button";
import { PlanSidebar, type BudgetPlan } from "@/components/budget-planner/plan-sidebar";
import type { UIMessage } from "ai";

export default function BudgetPlannerPage() {
  const [selectedPlan, setSelectedPlan] = useState<BudgetPlan | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  function handleNew() {
    setSelectedPlan(null);
  }

  function handleSelect(plan: BudgetPlan) {
    setSelectedPlan(plan);
  }

  function handleSaved() {
    setRefreshKey((k) => k + 1);
  }

  const chatMessages: UIMessage[] | undefined = selectedPlan
    ? (selectedPlan.messagesJson as UIMessage[])
    : undefined;

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-10 h-[calc(100vh-4rem)]">
      <div className="flex h-full">
        {/* Left sidebar */}
        <div className="w-64 shrink-0 h-full">
          <PlanSidebar
            selectedId={selectedPlan?.id ?? null}
            onSelect={handleSelect}
            onNew={handleNew}
            refreshKey={refreshKey}
          />
        </div>

        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0 h-full">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border/60 bg-card/20 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <MapPin className="h-5 w-5 text-primary shrink-0" />
              <h1 className="text-lg font-semibold text-foreground whitespace-nowrap">Budget Planner</h1>
              <Badge
                variant="secondary"
                className="text-xs bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"
              >
                Beta
              </Badge>
              {selectedPlan && (
                <span className="text-sm text-muted-foreground truncate ml-2">
                  — {selectedPlan.title.slice(0, 60)}
                  {selectedPlan.title.length > 60 ? "…" : ""}
                </span>
              )}
            </div>
            {selectedPlan && (
              <div className="flex items-center gap-2 shrink-0">
                <TrackActualExpensesButton
                  budgetPlanId={selectedPlan.id}
                  planTitle={selectedPlan.title}
                />
                <Button variant="ghost" size="sm" asChild className="text-xs h-7">
                  <Link href="/transactions/groups">Expense Groups</Link>
                </Button>
              </div>
            )}
          </div>

          {/* Chat area */}
          <div className="flex-1 min-h-0">
            {selectedPlan ? (
              <PlannerChat
                key={selectedPlan.id}
                initialMessages={chatMessages}
                readOnly={true}
                planForSavings={{
                  title: selectedPlan.title,
                  summaryText: selectedPlan.summaryText,
                  id: selectedPlan.id,
                }}
              />
            ) : (
              <PlannerChat
                key="new"
                onSaved={handleSaved}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
