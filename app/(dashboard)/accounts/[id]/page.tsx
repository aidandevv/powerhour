"use client";

import { useParams } from "next/navigation";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAccount, useBalanceHistory } from "@/hooks/use-accounts";
import { useTransactions } from "@/hooks/use-transactions";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { formatCurrency } from "@/lib/utils";

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: account, isLoading: accountLoading } = useAccount(id);
  const { data: balanceData } = useBalanceHistory(id, 90);
  const { data: txnData } = useTransactions({ accountId: id, limit: 25 });

  if (accountLoading) {
    return <p className="text-muted-foreground">Loading account...</p>;
  }

  if (!account || account.error) {
    return <p className="text-destructive">Account not found.</p>;
  }

  const snapshots = (balanceData?.snapshots || []).map(
    (s: { date: string; balance: string | null }) => ({
      date: s.date,
      balance: parseFloat(s.balance || "0"),
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{account.name}</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-muted-foreground">{account.institutionName}</span>
          <Badge variant="secondary">{account.subtype || account.type}</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(parseFloat(account.currentBalance || "0"))}
            </p>
          </CardContent>
        </Card>
        {account.availableBalance && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Available</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatCurrency(parseFloat(account.availableBalance))}
              </p>
            </CardContent>
          </Card>
        )}
        {account.creditLimit && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Credit Limit</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatCurrency(parseFloat(account.creditLimit))}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Balance History (90 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {snapshots.length < 2 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Not enough data for chart.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={snapshots}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) =>
                    new Date(v).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }
                  fontSize={12}
                />
                <YAxis
                  tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                  fontSize={12}
                />
                <Tooltip
                  formatter={(value: number) => [
                    formatCurrency(value),
                    "Balance",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke="hsl(222.2, 47.4%, 11.2%)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionTable transactions={txnData?.data || []} />
        </CardContent>
      </Card>
    </div>
  );
}
