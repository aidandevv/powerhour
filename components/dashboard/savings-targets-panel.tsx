"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { Target, ChevronDown, Trash2, TrendingUp } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

interface SavingsTarget {
  id: string;
  name: string;
  targetAmount: string;
  targetDate: string;
  monthlyAmount: string;
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function SavingsTargetsPanel() {
  const [isOpen, setIsOpen] = React.useState(false);
  const { data, error, mutate } = useSWR<SavingsTarget[]>(
    "/api/savings-targets",
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 10000, // Poll every 10 seconds to catch new targets from Ticker
    }
  );

  async function handleDelete(id: string) {
    await fetch(`/api/savings-targets/${id}`, { method: "DELETE" });
    mutate((prev) => prev?.filter((t) => t.id !== id), false);
  }

  const targets = data ?? [];
  const hasTargets = targets.length > 0;

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-accent/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-tertiary" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Savings targets
          </span>
          {hasTargets && (
            <span className="text-xs text-muted-foreground">
              ({targets.length})
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div className="px-5 pb-5 space-y-3 border-t border-border/60">
          {error && (
            <p className="text-sm text-destructive py-2">Failed to load targets.</p>
          )}
          {!error && !hasTargets && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No savings targets yet. Create one from a budget plan in the Budget Planner.
            </p>
          )}
          {hasTargets && (
            <div className="space-y-2">
              <Link
                href="/projections?tab=savings"
                className="flex items-center gap-2 text-xs text-primary hover:underline py-2"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                View cash flow projections →
              </Link>
              {targets.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 py-3 px-4 rounded-lg border border-border/40 bg-muted/30 group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatCurrency(parseFloat(t.targetAmount))} by{" "}
                      {new Date(t.targetDate).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}
                      {" · "}
                      {formatCurrency(parseFloat(t.monthlyAmount))}/mo
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive transition-opacity"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
