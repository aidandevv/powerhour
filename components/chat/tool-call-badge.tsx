/**
 * AGNT-04 / CHAT-03: Shows tool call activity as badges in the chat
 */
import { Badge } from "@/components/ui/badge";

const TOOL_LABELS: Record<string, string> = {
  getSpendingSummary: "Checking spending",
  getAccountBalances: "Looking up balances",
  searchTransactions: "Searching transactions",
  compareTrends: "Comparing trends",
  getRecurringExpenses: "Checking recurring expenses",
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
