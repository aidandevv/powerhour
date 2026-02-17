"use client";

import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Search, Loader2 } from "lucide-react";

interface SuggestionRow {
  id: string;
  date: string;
  name: string;
  merchantName: string | null;
  amount: number;
  category: string | null;
}

interface SuggestTransactionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (transactionIds: string[]) => void;
  defaultDateFrom?: string;
  defaultDateTo?: string;
}

export function SuggestTransactionsModal({
  open,
  onOpenChange,
  onAdd,
  defaultDateFrom,
  defaultDateTo,
}: SuggestTransactionsModalProps) {
  const [dateFrom, setDateFrom] = useState(defaultDateFrom ?? "");
  const [dateTo, setDateTo] = useState(defaultDateTo ?? "");

  useEffect(() => {
    if (open) {
      setDateFrom(defaultDateFrom ?? "");
      setDateTo(defaultDateTo ?? "");
    }
  }, [open, defaultDateFrom, defaultDateTo]);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSuggest() {
    if (!dateFrom || !dateTo) {
      setError("Date range is required");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/expense-groups/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateFrom,
          dateTo,
          query: query.trim() || undefined,
          limit: 50,
        }),
      });
      if (!res.ok) throw new Error("Failed to suggest");
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
      setSelectedIds(new Set());
    } catch {
      setError("Failed to load suggestions");
    } finally {
      setLoading(false);
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAddSelected() {
    onAdd(Array.from(selectedIds));
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg max-h-[85vh] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-lg flex flex-col">
          <Dialog.Title className="text-lg font-semibold flex items-center gap-2">
            <Search className="h-5 w-5" />
            Suggest Transactions
          </Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground mt-1">
            Find transactions by date range and optional keyword.
          </Dialog.Description>
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>From</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>To</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Keyword (optional)</Label>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Japan, Airbnb, hotel"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handleSuggest} disabled={loading} size="sm">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Searching…
                </>
              ) : (
                "Suggest"
              )}
            </Button>
          </div>
          {suggestions.length > 0 && (
            <div className="mt-4 flex-1 min-h-0 flex flex-col">
              <p className="text-xs text-muted-foreground mb-2">
                Select transactions to add ({selectedIds.size} selected)
              </p>
              <div className="border rounded-lg overflow-auto max-h-48">
                {suggestions.map((s) => (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between px-3 py-2 border-b last:border-0 cursor-pointer hover:bg-muted/50 ${
                      selectedIds.has(s.id) ? "bg-primary/5" : ""
                    }`}
                    onClick={() => toggleSelection(s.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {s.merchantName || s.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(s.date)} · {formatCurrency(s.amount)}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={() => toggleSelection(s.id)}
                      className="ml-2"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAddSelected}
                  disabled={selectedIds.size === 0}
                >
                  Add {selectedIds.size} selected
                </Button>
                <Dialog.Close asChild>
                  <Button type="button" variant="outline" size="sm">
                    Cancel
                  </Button>
                </Dialog.Close>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
