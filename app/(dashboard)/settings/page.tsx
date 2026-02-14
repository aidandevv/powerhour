"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlaidLinkButton } from "@/components/dashboard/plaid-link-button";
import { RefreshCw, Trash2, Link as LinkIcon } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Institution {
  id: string;
  institutionName: string;
  institutionId: string;
  status: string;
  errorCode: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  const { data, mutate } = useSWR<{ institutions: Institution[] }>(
    "/api/plaid/institutions",
    fetcher
  );
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleSyncAll() {
    setSyncingAll(true);
    try {
      await fetch("/api/sync", { method: "POST" });
      mutate();
    } finally {
      setSyncingAll(false);
    }
  }

  async function handleSyncOne(id: string) {
    setSyncingId(id);
    try {
      await fetch(`/api/sync/${id}`, { method: "POST" });
      mutate();
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this institution? All associated data will be deleted.")) {
      return;
    }
    setDeletingId(id);
    try {
      await fetch(`/api/plaid/institutions/${id}`, { method: "DELETE" });
      mutate();
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRelink(id: string) {
    try {
      const res = await fetch(`/api/plaid/institutions/${id}/relink`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.link_token) {
        // In a production app, we'd open Plaid Link with this token.
        // For now, we'll just note that the relink token was generated.
        alert("Relink initiated. Please reconnect your institution.");
      }
    } catch {
      console.error("Failed to initiate relink");
    }
  }

  const institutions = data?.institutions || [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Link Institution</CardTitle>
          <CardDescription>
            Connect a new bank, credit card, or investment account via Plaid.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlaidLinkButton onSuccess={() => mutate()} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Linked Institutions</CardTitle>
            <CardDescription>
              Manage your connected financial institutions.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAll}
            disabled={syncingAll}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 ${syncingAll ? "animate-spin" : ""}`}
            />
            Sync All
          </Button>
        </CardHeader>
        <CardContent>
          {institutions.length === 0 ? (
            <p className="text-muted-foreground">
              No institutions linked yet. Use the button above to get started.
            </p>
          ) : (
            <div className="space-y-4">
              {institutions.map((inst) => (
                <div
                  key={inst.id}
                  className="flex items-center justify-between py-3 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium">{inst.institutionName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant={
                          inst.status === "active"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {inst.status}
                      </Badge>
                      {inst.lastSyncedAt && (
                        <span className="text-xs text-muted-foreground">
                          Last synced:{" "}
                          {new Date(inst.lastSyncedAt).toLocaleString()}
                        </span>
                      )}
                      {inst.errorCode && (
                        <span className="text-xs text-destructive">
                          {inst.errorCode}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {inst.status === "relink_required" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRelink(inst.id)}
                      >
                        <LinkIcon className="h-4 w-4 mr-1" />
                        Relink
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleSyncOne(inst.id)}
                      disabled={syncingId === inst.id}
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${
                          syncingId === inst.id ? "animate-spin" : ""
                        }`}
                      />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(inst.id)}
                      disabled={deletingId === inst.id}
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
    </div>
  );
}
