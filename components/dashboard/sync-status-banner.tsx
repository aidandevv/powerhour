"use client";

import useSWR from "swr";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Institution {
  id: string;
  institutionName: string;
  status: string;
  errorCode: string | null;
  lastSyncedAt: string | null;
}

export function SyncStatusBanner() {
  const { data } = useSWR<{ institutions: Institution[] }>(
    "/api/plaid/institutions",
    fetcher
  );
  const [syncing, setSyncing] = useState(false);

  const errorInstitutions = data?.institutions?.filter(
    (i) => i.status === "error" || i.status === "relink_required"
  );

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch("/api/sync", { method: "POST" });
    } finally {
      setSyncing(false);
    }
  }

  if (!errorInstitutions?.length) {
    return null;
  }

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-5 mb-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium">
            {errorInstitutions.length} institution(s) need attention
          </p>
          <ul className="mt-1 text-sm text-muted-foreground">
            {errorInstitutions.map((inst) => (
              <li key={inst.id}>
                {inst.institutionName}:{" "}
                {inst.status === "relink_required"
                  ? "Requires re-authentication"
                  : `Error (${inst.errorCode || "unknown"})`}
              </li>
            ))}
          </ul>
        </div>
        <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
          <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
          Retry
        </Button>
      </div>
    </div>
  );
}
