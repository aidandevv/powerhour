"use client";

import useSWR from "swr";
import { Trash2, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UIMessage } from "ai";

export interface BudgetPlan {
  id: string;
  title: string;
  summaryText: string | null;
  messagesJson: UIMessage[];
  createdAt: string;
  updatedAt: string;
}

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error ?? `Failed to load plans (${r.status})`);
  }
  return r.json();
};

interface PlanSidebarProps {
  selectedId: string | null;
  onSelect: (plan: BudgetPlan) => void;
  onNew: () => void;
  refreshKey?: number;
}

export function PlanSidebar({ selectedId, onSelect, onNew, refreshKey }: PlanSidebarProps) {
  const { data, error, mutate } = useSWR<BudgetPlan[]>(
    "/api/budget-plans",
    fetcher,
    { refreshInterval: 0, revalidateOnFocus: false }
  );

  // Re-fetch when refreshKey changes (after saving a plan)
  useSWR(refreshKey ? `/api/budget-plans?r=${refreshKey}` : null, fetcher, {
    onSuccess: () => mutate(),
  });

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    await fetch(`/api/budget-plans/${id}`, { method: "DELETE" });
    mutate((prev) => prev?.filter((p) => p.id !== id), false);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div className="flex flex-col h-full border-r border-border/60 bg-card/30">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Saved Plans
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={onNew}
          title="New plan"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {error && (
          <p className="text-xs text-destructive px-4 py-2">
            Failed to load plans. {error.message}
          </p>
        )}

        {!data && !error && (
          <p className="text-xs text-muted-foreground px-4 py-2">Loading...</p>
        )}

        {data && data.length === 0 && (
          <div className="px-4 py-6 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No saved plans yet.</p>
            <p className="text-xs text-muted-foreground">
              Complete a budget to save it here.
            </p>
          </div>
        )}

        {Array.isArray(data) && data.map((plan) => (
          <button
            key={plan.id}
            onClick={() => onSelect(plan)}
            className={cn(
              "w-full text-left px-4 py-3 group flex items-start gap-2 hover:bg-accent/60 transition-colors border-b border-border/30",
              selectedId === plan.id && "bg-accent"
            )}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate leading-snug">
                {plan.title.slice(0, 40)}
                {plan.title.length > 40 ? "…" : ""}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDate(plan.createdAt)}
              </p>
            </div>
            <button
              onClick={(e) => handleDelete(e, plan.id)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity p-0.5 shrink-0 mt-0.5"
              title="Delete plan"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </button>
        ))}
      </div>
    </div>
  );
}
