"use client";

import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { useBalanceHistory } from "@/hooks/use-accounts";

interface AccountCardProps {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
  currentBalance: string | null;
  institutionName: string;
}

function BalanceSparkline({ accountId }: { accountId: string }) {
  const { data } = useBalanceHistory(accountId, 30);
  const snapshots = data?.snapshots || [];

  if (snapshots.length < 2) return null;

  const chartData = snapshots.map((s) => ({
    value: parseFloat(s.balance || "0"),
  }));

  return (
    <div className="h-10 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(222.2, 47.4%, 11.2%)"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AccountCard({
  id,
  name,
  type,
  subtype,
  currentBalance,
  institutionName,
}: AccountCardProps) {
  const balance = parseFloat(currentBalance || "0");

  return (
    <Link href={`/accounts/${id}`}>
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{name}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">
                {institutionName}
              </span>
              <Badge variant="secondary" className="text-xs">
                {subtype || type}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <BalanceSparkline accountId={id} />
            <span className="text-lg font-semibold whitespace-nowrap">
              {formatCurrency(balance)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
