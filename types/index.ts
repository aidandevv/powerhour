export interface ApiError {
  error: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DashboardSummary {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  monthToDateSpending: number;
  accounts: AccountSummary[];
}

export interface AccountSummary {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
  currentBalance: number | null;
  availableBalance: number | null;
  institutionName: string;
}

export interface TransactionItem {
  id: string;
  accountId: string;
  accountName: string | null;
  amount: number;
  date: string;
  name: string;
  merchantName: string | null;
  category: string | null;
  categoryDetailed: string | null;
  pending: boolean;
  paymentChannel: string | null;
  isRecurring: boolean;
  groups?: { id: string; name: string }[];
}

export interface RecurringItem {
  id: string;
  accountId: string;
  name: string;
  merchantName: string | null;
  amount: number;
  frequency: string;
  lastDate: string | null;
  nextProjectedDate: string | null;
  isActive: boolean;
  isUserConfirmed: boolean;
}

export interface ProjectedExpense {
  date: string;
  name: string;
  amount: number;
  accountId: string;
}

export interface BalanceSnapshot {
  date: string;
  balance: number;
}

export interface NetWorthDataPoint {
  date: string;
  netWorth: number;
}

export interface SpendingByCategory {
  category: string;
  amount: number;
}

export interface SpendingTrend {
  month: string;
  amount: number;
}

export interface MerchantSpend {
  name: string;
  logoUrl: string | null;
  amount: number;
  count: number;
}

export interface DailySpend {
  date: string;
  amount: number;
}

export interface CreditCard {
  id: string;
  name: string;
  balance: number;
  limit: number;
  utilization: number;
}

export interface AssetLiabilityPoint {
  date: string;
  assets: number;
  liabilities: number;
}

export interface AccountBalanceHistory {
  id: string;
  name: string;
  type: string;
  snapshots: { date: string; balance: number }[];
}

export interface CategoryTrendSeries {
  category: string;
  data: { month: string; amount: number }[];
}

export interface ChannelTrend {
  month: string;
  online: number;
  inStore: number;
  other: number;
}
