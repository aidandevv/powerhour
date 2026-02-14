"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRecentTransactions } from "@/hooks/use-dashboard";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function RecentTransactions() {
  const { data, isLoading } = useRecentTransactions();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : !data?.data?.length ? (
          <p className="text-muted-foreground">No transactions yet.</p>
        ) : (
          <div className="space-y-3">
            {data.data.map((txn) => (
              <div
                key={txn.id}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {txn.merchantName || txn.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {formatDate(txn.date)}
                    </span>
                    {txn.accountName && (
                      <Badge variant="secondary" className="text-xs">
                        {txn.accountName}
                      </Badge>
                    )}
                    {txn.isRecurring && (
                      <Badge variant="outline" className="text-xs">
                        Recurring
                      </Badge>
                    )}
                    {txn.pending && (
                      <Badge variant="outline" className="text-xs">
                        Pending
                      </Badge>
                    )}
                  </div>
                </div>
                <span
                  className={`text-sm font-medium ${
                    txn.amount > 0
                      ? "text-foreground"
                      : "text-green-600"
                  }`}
                >
                  {txn.amount > 0 ? "-" : "+"}
                  {formatCurrency(Math.abs(txn.amount))}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
