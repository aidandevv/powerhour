"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { useDashboardSummary } from "@/hooks/use-dashboard";
import { formatCurrency } from "@/lib/utils";
import { Wallet, Landmark, TrendingUp, CreditCard } from "lucide-react";

function getIconForType(type: string) {
  switch (type?.toLowerCase()) {
    case "credit":
      return CreditCard;
    case "depository":
      return Landmark;
    case "investment":
      return TrendingUp;
    default:
      return Wallet;
  }
}

function getTypeLabel(type: string, subtype: string | null) {
  if (subtype) return subtype.charAt(0).toUpperCase() + subtype.slice(1).replace(/_/g, " ");
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function AccountOverview() {
  const { data, isLoading } = useDashboardSummary();
  const accounts = data?.accounts ?? [];

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border/60 bg-card p-4 shadow-card">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Account Overview</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-lg border border-border/40 bg-muted/30 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="rounded-lg border border-border/60 bg-card p-4 shadow-card">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Account Overview</p>
        <p className="text-sm text-muted-foreground">No accounts yet. Link a bank to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Account Overview</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {accounts.slice(0, 4).map((acct) => {
          const Icon = getIconForType(acct.type);
          const balance = acct.currentBalance ?? 0;
          return (
            <Link key={acct.id} href={`/accounts/${acct.id}`}>
              <Card className="border-border/60 transition-colors hover:bg-accent/50 cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-tertiary/30">
                        <Icon className="h-5 w-5 text-tertiary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{getTypeLabel(acct.type, acct.subtype)}</p>
                        <p className="text-xs text-muted-foreground truncate">{acct.institutionName}</p>
                      </div>
                    </div>
                    <p className="text-lg font-semibold text-foreground whitespace-nowrap">
                      {formatCurrency(balance)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
