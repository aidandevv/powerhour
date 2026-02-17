"use client";

import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, CheckCircle, CreditCard, X } from "lucide-react";
import type { RecurringAuditResult, RecurringAuditItem } from "@/lib/agent/tools/recurring-audit";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function frequencyLabel(f: string): string {
  return { weekly: "Weekly", biweekly: "Biweekly", monthly: "Monthly", annually: "Annual" }[f] ?? f;
}

function toMonthlyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case "weekly": return amount * (52 / 12);
    case "biweekly": return amount * (26 / 12);
    case "monthly": return amount;
    case "annually": return amount / 12;
    default: return amount;
  }
}

function SubscriptionCard({
  item,
  onDeactivate,
}: {
  item: RecurringAuditItem;
  onDeactivate: (id: string) => void;
}) {
  const monthly = toMonthlyAmount(item.amount, item.frequency);

  return (
    <div
      className={`flex items-start justify-between rounded-lg border p-4 ${
        item.flagged
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-border/60 bg-card"
      }`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div
          className={`mt-0.5 shrink-0 rounded-full p-1.5 ${
            item.flagged
              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              : "bg-primary/10 text-primary"
          }`}
        >
          {item.flagged ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm leading-snug truncate">{item.name}</p>
          {item.merchantName && item.merchantName !== item.name && (
            <p className="text-xs text-muted-foreground truncate">{item.merchantName}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <Badge variant="secondary" className="text-xs">
              {frequencyLabel(item.frequency)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatCurrency(item.amount)}
            </span>
            {item.frequency !== "monthly" && (
              <span className="text-xs text-muted-foreground">
                ≈ {formatCurrency(monthly)}/mo
              </span>
            )}
          </div>
          <p
            className={`text-xs mt-1 ${
              item.flagged
                ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground"
            }`}
          >
            {item.reason}
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive ml-2"
        title="Deactivate"
        onClick={() => onDeactivate(item.id)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function SubscriptionsPage() {
  const { data, mutate } = useSWR<RecurringAuditResult>("/api/subscriptions", fetcher);

  async function handleDeactivate(id: string) {
    await fetch(`/api/recurring/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    mutate();
  }

  const flagged = data?.items.filter((i) => i.flagged) ?? [];
  const active = data?.items.filter((i) => !i.flagged) ?? [];

  const totalMonthly = (data?.items ?? []).reduce(
    (sum, i) => sum + toMonthlyAmount(i.amount, i.frequency),
    0
  );
  const atRiskMonthly = flagged.reduce(
    (sum, i) => sum + toMonthlyAmount(i.amount, i.frequency),
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Subscriptions</h1>
        <p className="text-muted-foreground mt-1">
          Review your recurring expenses and cancel anything you no longer use.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              Total Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data?.items.length ?? "—"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatCurrency(totalMonthly)}/mo
            </p>
          </CardContent>
        </Card>

        <Card className={flagged.length > 0 ? "border-amber-500/40" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle
                className={`h-4 w-4 ${
                  flagged.length > 0
                    ? "text-amber-500"
                    : "text-muted-foreground"
                }`}
              />
              Possibly Unused
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{flagged.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {flagged.length > 0
                ? `≈ ${formatCurrency(atRiskMonthly)}/mo at risk`
                : "All have recent activity"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              If Cancelled All Flagged
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(atRiskMonthly)}/mo
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatCurrency(atRiskMonthly * 12)}/yr saved
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Flagged subscriptions */}
      {flagged.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Possibly Unused
            <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400 border-amber-500/40">
              {flagged.length}
            </Badge>
          </h2>
          <div className="space-y-2">
            {flagged.map((item) => (
              <SubscriptionCard
                key={item.id}
                item={item}
                onDeactivate={handleDeactivate}
              />
            ))}
          </div>
        </section>
      )}

      {/* Active subscriptions */}
      <section>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-primary" />
          Active
          <Badge variant="outline" className="text-xs">{active.length}</Badge>
        </h2>
        {active.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No active subscriptions with recent activity.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {active.map((item) => (
              <SubscriptionCard
                key={item.id}
                item={item}
                onDeactivate={handleDeactivate}
              />
            ))}
          </div>
        )}
      </section>

      {data?.items.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">No recurring items detected yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Sync your accounts to detect subscriptions and recurring bills.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
