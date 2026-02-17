"use client";

import { useDashboardSummary } from "@/hooks/use-dashboard";
import { formatCurrency } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function maskAccountId(id: string): string {
  if (id.length < 4) return "****";
  return `****${id.slice(-4)}`;
}

export function AccountSummaryTable() {
  const { data, isLoading } = useDashboardSummary();
  const accounts = data?.accounts ?? [];

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border/60 bg-card overflow-hidden shadow-card">
        <div className="border-b border-border/60 bg-primary px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-primary-foreground">Account Summary</p>
        </div>
        <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="rounded-lg border border-border/60 bg-card overflow-hidden shadow-card">
        <div className="border-b border-border/60 bg-primary px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-primary-foreground">Account Summary</p>
        </div>
        <div className="p-8 text-center text-muted-foreground text-sm">No accounts yet. Link a bank to get started.</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow className="border-0 bg-primary hover:bg-primary">
            <TableHead className="h-11 px-4 text-left font-medium text-primary-foreground">Institution</TableHead>
            <TableHead className="h-11 px-4 text-left font-medium text-primary-foreground">Account</TableHead>
            <TableHead className="h-11 px-4 text-left font-medium text-primary-foreground">Type</TableHead>
            <TableHead className="h-11 px-4 text-right font-medium text-primary-foreground">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((acct) => (
            <TableRow key={acct.id} className="border-border/40">
              <TableCell className="font-medium">{acct.institutionName}</TableCell>
              <TableCell className="text-muted-foreground">{maskAccountId(acct.id)}</TableCell>
              <TableCell className="text-muted-foreground capitalize">{acct.subtype || acct.type}</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(acct.currentBalance ?? 0)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
