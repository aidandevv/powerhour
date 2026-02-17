"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Receipt, Loader2 } from "lucide-react";

interface TrackActualExpensesButtonProps {
  budgetPlanId: string;
  planTitle: string;
}

export function TrackActualExpensesButton({ budgetPlanId, planTitle }: TrackActualExpensesButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(`/api/expense-groups?budgetPlanId=${budgetPlanId}`);
      const data = await res.json();
      const groups = data?.groups ?? [];

      if (groups.length > 0) {
        router.push(`/transactions/groups/${groups[0].id}`);
        return;
      }

      const createRes = await fetch("/api/expense-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: planTitle.slice(0, 200),
          budgetPlanId,
        }),
      });

      if (!createRes.ok) throw new Error("Failed to create group");
      const created = await createRes.json();
      router.push(`/transactions/groups/${created.id}`);
    } catch {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading}
      className="gap-1.5 text-xs h-7"
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Receipt className="h-3 w-3" />
      )}
      Track actual expenses
    </Button>
  );
}
