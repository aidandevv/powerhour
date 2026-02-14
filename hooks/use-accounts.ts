import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export interface AccountWithInstitution {
  id: string;
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
  currencyCode: string;
  currentBalance: string | null;
  availableBalance: string | null;
  creditLimit: string | null;
  isActive: boolean;
  institutionId: string;
  institutionName: string;
  institutionStatus: string;
}

export interface InstitutionGroup {
  institutionId: string;
  institutionName: string;
  status: string;
  accounts: AccountWithInstitution[];
}

export function useAccounts() {
  return useSWR<{ institutions: InstitutionGroup[] }>("/api/accounts", fetcher);
}

export function useAccount(id: string) {
  return useSWR(`/api/accounts/${id}`, fetcher);
}

export function useBalanceHistory(accountId: string, days = 90) {
  return useSWR<{
    snapshots: { date: string; balance: string | null; available: string | null }[];
  }>(`/api/accounts/${accountId}/balance-history?days=${days}`, fetcher);
}
