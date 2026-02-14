import useSWR from "swr";
import type { PaginatedResponse, TransactionItem } from "@/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export interface TransactionFilters {
  page?: number;
  limit?: number;
  accountId?: string;
  category?: string;
  from?: string;
  to?: string;
  search?: string;
}

export function useTransactions(filters: TransactionFilters = {}) {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", filters.page.toString());
  if (filters.limit) params.set("limit", filters.limit.toString());
  if (filters.accountId) params.set("account_id", filters.accountId);
  if (filters.category) params.set("category", filters.category);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.search) params.set("search", filters.search);

  const query = params.toString();
  return useSWR<PaginatedResponse<TransactionItem>>(
    `/api/transactions${query ? `?${query}` : ""}`,
    fetcher,
    { keepPreviousData: true }
  );
}
