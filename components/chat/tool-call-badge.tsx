/** Inline badge showing tool call status (loading spinner / checkmark / error). */
import { Badge } from "@/components/ui/badge";

const TOOL_LABELS: Record<string, string> = {
  get_spending_summary: "Checking spending",
  get_account_balances: "Looking up balances",
  search_transactions: "Searching transactions",
  compare_trends: "Comparing trends",
  get_recurring_expenses: "Checking recurring expenses",
  audit_recurring_expenses: "Auditing subscriptions",
  get_cash_flow_forecast: "Forecasting cash flow",
  get_merchant_category_info: "Looking up merchant categories",
  generate_report: "Preparing report",
  detect_anomalies: "Scanning for anomalies",
  get_debt_payoff: "Calculating debt payoff",
  get_weekly_digest: "Loading weekly digest",
  suggest_transactions_for_group: "Finding transactions for group",
  create_expense_group: "Creating expense group",
  add_transactions_to_group: "Adding to expense group",
};

interface ToolCallBadgeProps {
  toolName: string;
  state: string;
}

export function ToolCallBadge({ toolName, state }: ToolCallBadgeProps) {
  const label = TOOL_LABELS[toolName] ?? toolName;
  const isLoading = state !== "output-available" && state !== "output-error";

  return (
    <Badge variant="secondary" className="text-xs gap-1.5">
      {isLoading && (
        <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
      )}
      {label}
      {state === "output-available" && " \u2713"}
      {state === "output-error" && " \u2717"}
    </Badge>
  );
}
