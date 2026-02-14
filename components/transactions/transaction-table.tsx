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
}

export function TransactionTable({ transactions }: TransactionTableProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No transactions found.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((txn) => (
          <TableRow key={txn.id}>
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
