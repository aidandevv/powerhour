"use client";

import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/utils";

interface ChangeBadgeProps {
  value: number;
  className?: string;
}

export function ChangeBadge({ value, className }: ChangeBadgeProps) {
  const isPositive = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
        isPositive
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400"
          : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400",
        className
      )}
    >
      {formatPercent(value)}
    </span>
  );
}
