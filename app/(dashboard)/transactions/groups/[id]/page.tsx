"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SuggestTransactionsModal } from "@/components/expense-groups/suggest-transactions-modal";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ExpenseGroupDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [suggestOpen, setSuggestOpen] = useState(false);
  const { data, mutate } = useSWR(
    params.id ? `/api/expense-groups/${params.id}` : null,
    fetcher
  );

  async function handleSuggestAdd(transactionIds: string[]) {
    if (transactionIds.length === 0) return;
    await fetch(`/api/expense-groups/${params.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionIds }),
    });
    mutate();
    setSuggestOpen(false);
  }

  async function handleRemoveMember(transactionId: string) {
    await fetch(`/api/expense-groups/${params.id}/members/${transactionId}`, {
      method: "DELETE",
    });
    mutate();
  }

  if (!data && !params.id) return null;
  if (data?.error) {
    return (
      <div className="p-6">
        <p className="text-destructive">Group not found.</p>
        <Link href="/transactions/groups" className="text-sm text-primary mt-2 inline-block">
          ← Back to groups
        </Link>
      </div>
    );
  }

  const group = data;
  const members = group?.members ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/transactions/groups"
          className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Expense Groups
        </Link>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-3xl font-bold">{group?.name ?? "Loading…"}</h1>
            {group?.description && (
              <p className="text-muted-foreground mt-1">{group.description}</p>
            )}
          </div>
          <Button onClick={() => setSuggestOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Transactions
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Transactions</CardTitle>
          <p className="text-sm text-muted-foreground font-normal">
            Total: {formatCurrency(group?.totalAmount ?? 0)}
          </p>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="mb-4">No transactions in this group yet.</p>
              <Button variant="outline" onClick={() => setSuggestOpen(true)}>
                Suggest transactions
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((m: { id: string; transactionId: string; date: string; name: string; merchantName: string | null; amount: number; category: string | null; accountName: string }) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg border border-border/40 group"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {m.merchantName || m.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(m.date)} · {m.accountName}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">
                      {formatCurrency(m.amount)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveMember(m.transactionId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <SuggestTransactionsModal
        open={suggestOpen}
        onOpenChange={setSuggestOpen}
        onAdd={handleSuggestAdd}
        defaultDateFrom={group?.dateFrom ?? undefined}
        defaultDateTo={group?.dateTo ?? undefined}
      />
    </div>
  );
}
