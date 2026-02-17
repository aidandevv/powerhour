"use client";

import { useDashboardSummary } from "@/hooks/use-dashboard";
import { useNetWorthHistory } from "@/hooks/use-dashboard";
import { formatCurrency } from "@/lib/utils";
import { ChangeBadge } from "./change-badge";

function useNetWorthChanges() {
  const { data: summary } = useDashboardSummary();
  const { data: historyData } = useNetWorthHistory(365);
  const history = historyData?.history ?? [];

  if (!summary || history.length < 2) {
    return { mtdChange: null, mtdPct: null, ytdChange: null, ytdPct: null };
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];
  const currentNetWorth = summary.netWorth;

  // Use last snapshot on or before period start
  const beforeMonth = history.filter((h) => h.date <= monthStart);
  const beforeYear = history.filter((h) => h.date <= yearStart);
  const mtdStartVal = beforeMonth.length > 0 ? beforeMonth[beforeMonth.length - 1].netWorth : currentNetWorth;
  const ytdStartVal = beforeYear.length > 0 ? beforeYear[beforeYear.length - 1].netWorth : currentNetWorth;

  const mtdChange = currentNetWorth - mtdStartVal;
  const mtdPct = mtdStartVal !== 0 ? (mtdChange / Math.abs(mtdStartVal)) * 100 : 0;
  const ytdChange = currentNetWorth - ytdStartVal;
  const ytdPct = ytdStartVal !== 0 ? (ytdChange / Math.abs(ytdStartVal)) * 100 : 0;

  return { mtdChange, mtdPct, ytdChange, ytdPct };
}

export function DashboardHero() {
  const { data, isLoading } = useDashboardSummary();
  const { mtdChange, mtdPct, ytdChange, ytdPct } = useNetWorthChanges();

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border/60 bg-card p-6 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Net Worth</p>
            <p className="text-2xl font-semibold tracking-tight">—</p>
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
          <div className="flex gap-6 text-sm">
            <div><span className="text-muted-foreground">Assets</span> —</div>
            <div><span className="text-muted-foreground">Liabilities</span> —</div>
            <div><span className="text-muted-foreground">Liquidity</span> —</div>
          </div>
        </div>
      </div>
    );
  }

  const netWorth = data?.netWorth ?? 0;
  const assets = data?.totalAssets ?? 0;
  const liabilities = data?.totalLiabilities ?? 0;
  const liquidity = assets; // or available balance sum; using assets as proxy

  return (
    <div className="rounded-lg border border-border/60 bg-card p-6 shadow-card">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Net Worth</p>
          <p className="text-2xl font-semibold tracking-tight text-foreground">{formatCurrency(netWorth)}</p>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {mtdChange != null && mtdPct != null && (
              <span className="flex items-center gap-1.5">
                MTD: {formatCurrency(mtdChange)} <ChangeBadge value={mtdPct} />
              </span>
            )}
            {ytdChange != null && ytdPct != null && (
              <span className="flex items-center gap-1.5">
                YTD: {formatCurrency(ytdChange)} <ChangeBadge value={ytdPct} />
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Assets</p>
            <p className="text-lg font-semibold text-foreground">{formatCurrency(assets)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Liabilities</p>
            <p className="text-lg font-semibold text-foreground">{formatCurrency(liabilities)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Liquidity</p>
            <p className="text-lg font-semibold text-foreground">{formatCurrency(liquidity)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
