"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTransactions } from "@/hooks/use-transactions";
import { useExpenseGroups } from "@/hooks/use-expense-groups";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { CreateGroupModal } from "@/components/expense-groups/create-group-modal";
import { AddToGroupDropdown } from "@/components/expense-groups/add-to-group-dropdown";
import { SuggestTransactionsModal } from "@/components/expense-groups/suggest-transactions-modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ChevronLeft, ChevronRight, FolderPlus, Sparkles } from "lucide-react";

export default function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [category, setCategory] = useState("");
  const [groupId, setGroupId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const limit = 25;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, mutate } = useTransactions({
    page,
    limit,
    search: debouncedSearch || undefined,
    from: from || undefined,
    to: to || undefined,
    category: category || undefined,
    groupId: groupId || undefined,
  });
  const { data: groupsData } = useExpenseGroups();
  const groups = groupsData?.groups ?? [];

  function handleCreateGroupSuccess(newGroupId?: string) {
    mutate();
    if (newGroupId) setGroupId(newGroupId);
  }

  function handleAddToGroup() {
    mutate();
    setSelectedIds(new Set());
  }

  function handleSuggestAdd(transactionIds: string[]) {
    setSelectedIds(new Set(transactionIds));
    setSuggestOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Transactions</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/transactions/groups" className="gap-2">
              <FolderPlus className="h-4 w-4" />
              Expense Groups
            </Link>
          </Button>
          <Button size="sm" onClick={() => setCreateGroupOpen(true)} className="gap-2">
            <FolderPlus className="h-4 w-4" />
            Create Group
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search transactions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className="w-40"
              placeholder="From"
            />
            <Input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              className="w-40"
              placeholder="To"
            />
            <Input
              placeholder="Category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="w-40"
            />
            <Select value={groupId || "all"} onValueChange={(v) => { setGroupId(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(debouncedSearch || search || from || to || category || groupId) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  setDebouncedSearch("");
                  setFrom("");
                  setTo("");
                  setCategory("");
                  setGroupId("");
                  setPage(1);
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {selectedIds.size > 0 && (
            <div className="mb-4 flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
              <span className="text-sm">
                {selectedIds.size} selected
              </span>
              <div className="flex gap-2 items-center">
                <AddToGroupDropdown
                  transactionIds={Array.from(selectedIds)}
                  groups={groups}
                  onSuccess={handleAddToGroup}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSuggestOpen(true)}
                  className="gap-1"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Suggest
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Clear
                </Button>
              </div>
            </div>
          )}
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading transactions...
            </div>
          ) : (
            <>
              <TransactionTable
                transactions={data?.data || []}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
              />

              {data && data.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {data.page} of {data.totalPages} ({data.total} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= data.totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <CreateGroupModal
        open={createGroupOpen}
        onOpenChange={setCreateGroupOpen}
        onSuccess={handleCreateGroupSuccess}
        defaultDateFrom={from || undefined}
        defaultDateTo={to || undefined}
      />
      <SuggestTransactionsModal
        open={suggestOpen}
        onOpenChange={setSuggestOpen}
        onAdd={handleSuggestAdd}
        defaultDateFrom={from || undefined}
        defaultDateTo={to || undefined}
      />
    </div>
  );
}
