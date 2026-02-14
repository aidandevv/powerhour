import useSWR from "swr";
import type {
  DashboardSummary,
  NetWorthDataPoint,
  SpendingByCategory,
  SpendingTrend,
  TransactionItem,
  MerchantSpend,
  DailySpend,
  CreditCard,
  AssetLiabilityPoint,
  AccountBalanceHistory,
  CategoryTrendSeries,
  ChannelTrend,
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

export function useTopMerchants(from?: string, to?: string, limit = 10) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return useSWR<{ merchants: MerchantSpend[]; from: string; to: string }>(
    `/api/transactions/merchants?${params}`,
    fetcher
  );
}

export function useDailySpending(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const q = params.toString();
  return useSWR<{ days: DailySpend[] }>(
    `/api/transactions/daily${q ? `?${q}` : ""}`,
    fetcher
  );
}

export function useCreditUtilization() {
  return useSWR<{ cards: CreditCard[] }>("/api/dashboard/credit-utilization", fetcher);
}

export function useAssetLiabilityHistory(days = 365) {
  return useSWR<{ history: AssetLiabilityPoint[] }>(
    `/api/dashboard/asset-liability-history?days=${days}`,
    fetcher
  );
}

export function useAccountBalancesHistory(days = 90) {
  return useSWR<{ accounts: AccountBalanceHistory[] }>(
    `/api/dashboard/account-balances-history?days=${days}`,
    fetcher
  );
}

export function useCategoryTrends(months = 6, limit = 6) {
  return useSWR<{ categories: CategoryTrendSeries[]; months: string[] }>(
    `/api/dashboard/category-trends?months=${months}&limit=${limit}`,
    fetcher
  );
}

export function useChannelTrends(months = 6) {
  return useSWR<{ trends: ChannelTrend[] }>(
    `/api/dashboard/channel-trends?months=${months}`,
    fetcher
  );
}
