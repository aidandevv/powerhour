"use client";

import { useState } from "react";
import Link from "next/link";
import { useExpenseGroups } from "@/hooks/use-expense-groups";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateGroupModal } from "@/components/expense-groups/create-group-modal";
import { SuggestTransactionsModal } from "@/components/expense-groups/suggest-transactions-modal";
import { FolderPlus, ChevronRight, Plus } from "lucide-react";

export default function ExpenseGroupsPage() {
  const { data, mutate } = useExpenseGroups();
  const [createOpen, setCreateOpen] = useState(false);
  const [suggestGroupId, setSuggestGroupId] = useState<string | null>(null);
  const groups = data?.groups ?? [];
  const suggestGroup = suggestGroupId
    ? groups.find((g) => g.id === suggestGroupId)
    : null;

  function handleCreateSuccess(id?: string) {
    mutate();
    if (id) setSuggestGroupId(id);
  }

  async function handleSuggestAdd(transactionIds: string[]) {
    if (!suggestGroupId || transactionIds.length === 0) return;
    await fetch(`/api/expense-groups/${suggestGroupId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionIds }),
    });
    mutate();
    setSuggestGroupId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/transactions"
            className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
          >
            ← Transactions
          </Link>
          <h1 className="text-3xl font-bold">Expense Groups</h1>
          <p className="text-muted-foreground mt-1">
            Group transactions (trips, projects, events) for easier tracking.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Group
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {groups.length === 0 ? (
            <div className="text-center py-12">
              <FolderPlus className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                No expense groups yet.
              </p>
              <Button onClick={() => setCreateOpen(true)} variant="outline">
                Create your first group
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between py-3 px-4 rounded-lg border border-border/60 hover:bg-muted/30"
                >
                  <div>
                    <p className="font-medium">{g.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {g.memberCount ?? 0} transactions
                      {g.dateFrom && g.dateTo && (
                        <> · {g.dateFrom} to {g.dateTo}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">
                      {formatCurrency(g.totalAmount ?? 0)}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSuggestGroupId(g.id)}
                      >
                        Add
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/transactions/groups/${g.id}`} className="gap-1">
                          View
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateGroupModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={handleCreateSuccess}
      />
      <SuggestTransactionsModal
        open={!!suggestGroupId}
        onOpenChange={(open) => !open && setSuggestGroupId(null)}
        onAdd={handleSuggestAdd}
        defaultDateFrom={suggestGroup?.dateFrom ?? undefined}
        defaultDateTo={suggestGroup?.dateTo ?? undefined}
      />
    </div>
  );
}
