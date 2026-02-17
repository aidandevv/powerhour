import useSWR from "swr";

export interface ExpenseGroup {
  id: string;
  name: string;
  description: string | null;
  budgetPlanId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  createdAt: string;
  memberCount?: number;
  totalAmount?: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useExpenseGroups() {
  return useSWR<{ groups: ExpenseGroup[] }>("/api/expense-groups", fetcher);
}
