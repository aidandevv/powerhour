"use client";

import { useAccounts } from "@/hooks/use-accounts";
import { AccountCard } from "@/components/dashboard/account-card";
import { Badge } from "@/components/ui/badge";

export default function AccountsPage() {
  const { data, isLoading } = useAccounts();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Accounts</h1>

      {isLoading ? (
        <p className="text-muted-foreground">Loading accounts...</p>
      ) : !data?.institutions?.length ? (
        <p className="text-muted-foreground">
          No accounts linked. Go to Settings to link a financial institution.
        </p>
      ) : (
        data.institutions.map((group) => (
          <div key={group.institutionId} className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">
                {group.institutionName}
              </h2>
              {group.status !== "active" && (
                <Badge variant="destructive">{group.status}</Badge>
              )}
            </div>
            <div className="grid gap-3">
              {group.accounts.map((account) => (
                <AccountCard
                  key={account.id}
                  id={account.id}
                  name={account.name}
                  type={account.type}
                  subtype={account.subtype}
                  currentBalance={account.currentBalance}
                  institutionName={group.institutionName}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
