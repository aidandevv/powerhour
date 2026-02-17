"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatCategory } from "@/lib/utils";
import type { TransactionItem } from "@/types";

interface TransactionTableProps {
  transactions: TransactionItem[];
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

export function TransactionTable({
  transactions,
  selectedIds = new Set(),
  onSelectionChange,
}: TransactionTableProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No transactions found.
      </div>
    );
  }

  function toggleSelect(id: string) {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }

  function toggleSelectAll() {
    if (!onSelectionChange) return;
    if (selectedIds.size === transactions.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(transactions.map((t) => t.id)));
    }
  }

  const showSelection = !!onSelectionChange;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showSelection && (
            <TableHead className="w-10">
              <input
                type="checkbox"
                checked={
                  transactions.length > 0 &&
                  selectedIds.size === transactions.length
                }
                onChange={toggleSelectAll}
                className="cursor-pointer"
              />
            </TableHead>
          )}
          <TableHead>Date</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Group</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((txn) => (
          <TableRow key={txn.id}>
            {showSelection && (
              <TableCell>
                <input
                  type="checkbox"
                  checked={selectedIds.has(txn.id)}
                  onChange={() => toggleSelect(txn.id)}
                  className="cursor-pointer"
                />
              </TableCell>
            )}
            <TableCell className="whitespace-nowrap">
              {formatDate(txn.date)}
            </TableCell>
            <TableCell>
              <div>
                <p className="font-medium">{txn.merchantName || txn.name}</p>
                {txn.merchantName && txn.merchantName !== txn.name && (
                  <p className="text-xs text-muted-foreground">{txn.name}</p>
                )}
              </div>
            </TableCell>
            <TableCell>
              {txn.category && (
                <Badge variant="secondary">{formatCategory(txn.category)}</Badge>
              )}
            </TableCell>
            <TableCell>
              {txn.groups && txn.groups.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {txn.groups.map((g) => (
                    <Badge key={g.id} variant="outline" className="text-xs">
                      {g.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground text-xs">—</span>
              )}
            </TableCell>
            <TableCell>
              {txn.pending && (
                <Badge variant="outline">Pending</Badge>
              )}
            </TableCell>
            <TableCell
              className={`text-right font-medium ${
                txn.amount > 0 ? "text-foreground" : "text-green-600"
              }`}
            >
              {txn.amount > 0 ? "-" : "+"}
              {formatCurrency(Math.abs(txn.amount))}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
