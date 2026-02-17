"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ExpenseGroup } from "@/hooks/use-expense-groups";

interface AddToGroupDropdownProps {
  transactionIds: string[];
  groups: ExpenseGroup[];
  onSuccess?: () => void;
}

export function AddToGroupDropdown({
  transactionIds,
  groups,
  onSuccess,
}: AddToGroupDropdownProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    if (!selectedGroupId || transactionIds.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/expense-groups/${selectedGroupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionIds }),
      });
      if (!res.ok) throw new Error("Failed to add");
      setSelectedGroupId("");
      onSuccess?.();
    } catch {
      // silent fail for now
    } finally {
      setLoading(false);
    }
  }

  if (groups.length === 0) return null;

  return (
    <div className="flex gap-2 items-center">
      <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
        <SelectTrigger className="w-[200px] h-9">
          <SelectValue placeholder="Select group" />
        </SelectTrigger>
        <SelectContent>
          {groups.map((g) => (
            <SelectItem key={g.id} value={g.id}>
              {g.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        onClick={handleAdd}
        disabled={!selectedGroupId || loading}
      >
        {loading ? "Adding…" : "Add"}
      </Button>
    </div>
  );
}
