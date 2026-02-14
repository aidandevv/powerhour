import useSWR from "swr";
import type {
  DashboardSummary,
  NetWorthDataPoint,
  SpendingByCategory,
  SpendingTrend,
  TransactionItem,
} from "@/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useDashboardSummary() {
  return useSWR<DashboardSummary>("/api/dashboard/summary", fetcher, {
    revalidateOnFocus: true,
    refreshInterval: 60000,
  });
}

export function useNetWorthHistory(days = 365) {
  return useSWR<{ history: NetWorthDataPoint[] }>(
    `/api/dashboard/net-worth-history?days=${days}`,
    fetcher
  );
}

export function useSpendingSummary(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();
  return useSWR<{ summary: SpendingByCategory[] }>(
    `/api/transactions/summary${query ? `?${query}` : ""}`,
    fetcher
  );
}

export function useSpendingTrends(months = 6) {
  return useSWR<{ trends: SpendingTrend[] }>(
    `/api/dashboard/spending-trends?months=${months}`,
    fetcher
  );
}

export function useRecentTransactions(limit = 10) {
  return useSWR<{ data: TransactionItem[] }>(
    `/api/transactions?limit=${limit}&page=1`,
    fetcher
  );
}
