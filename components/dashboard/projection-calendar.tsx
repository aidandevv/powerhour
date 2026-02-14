"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { ProjectedExpense } from "@/types";

interface ProjectionCalendarProps {
  projections: ProjectedExpense[];
}

export function ProjectionCalendar({ projections }: ProjectionCalendarProps) {
  // Group projections by date
  const grouped: Record<string, ProjectedExpense[]> = {};
  for (const p of projections) {
    if (!grouped[p.date]) grouped[p.date] = [];
    grouped[p.date].push(p);
  }

  const dates = Object.keys(grouped).sort();

  if (dates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Projected Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No projected expenses.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Projected Expenses (90 days)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {dates.map((date) => {
            const items = grouped[date];
            const dayTotal = items.reduce((s, i) => s + i.amount, 0);
            return (
              <div key={date} className="border-b pb-3 last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">
                    {new Date(date).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="text-sm font-semibold">
                    {formatCurrency(dayTotal)}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {items.map((item, i) => (
                    <div
                      key={`${item.name}-${i}`}
                      className="flex justify-between text-xs text-muted-foreground"
                    >
                      <span>{item.name}</span>
                      <span>{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
