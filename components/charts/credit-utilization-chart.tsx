"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreditUtilization } from "@/hooks/use-dashboard";
import { cn } from "@/lib/utils";

function utilizationColor(pct: number) {
  if (pct >= 90) return "bg-destructive";
  if (pct >= 70) return "bg-amber-500";
  if (pct >= 30) return "bg-yellow-400";
  return "bg-emerald-500";
}

export function CreditUtilizationChart() {
  const { data, isLoading } = useCreditUtilization();

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Credit Utilization</CardTitle></CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground">Loading...</CardContent>
      </Card>
    );
  }

  const cards = data?.cards ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credit Utilization</CardTitle>
      </CardHeader>
      <CardContent>
        {cards.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            No credit accounts with limits found.
          </div>
        ) : (
          <div className="space-y-4">
            {cards.map((card) => (
              <div key={card.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium truncate max-w-[60%]">{card.name}</span>
                  <span className="text-sm text-muted-foreground">
                    ${card.balance.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    {" / "}
                    ${card.limit.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    {" · "}
                    <span
                      className={cn(
                        "font-semibold",
                        card.utilization >= 70 ? "text-destructive" : ""
                      )}
                    >
                      {card.utilization}%
                    </span>
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", utilizationColor(card.utilization))}
                    style={{ width: `${Math.min(card.utilization, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
