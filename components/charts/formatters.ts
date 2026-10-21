import { formatCurrency } from "@/lib/utils";

export function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseFloat(value) || 0;
  return 0;
}

export function asText(value: unknown): string {
  return value == null ? "" : String(value);
}

export function currencyTooltipValue(value: unknown): string {
  return formatCurrency(asNumber(value));
}
