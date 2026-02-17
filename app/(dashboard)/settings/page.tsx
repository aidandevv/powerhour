"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlaidLinkButton } from "@/components/dashboard/plaid-link-button";
import { PlaidRelinkButton } from "@/components/dashboard/plaid-relink-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/components/theme-provider";
import { RefreshCw, Trash2, KeyRound, ShieldCheck, Clock } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const ACTION_LABELS: Record<string, string> = {
  login: "Signed in",
  logout: "Signed out",
  password_change: "Changed password",
  institution_link: "Linked institution",
  institution_delete: "Removed institution",
  report_download: "Downloaded report",
};

interface AuditEvent {
  id: string;
  action: string;
  ip: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

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
  const { theme } = useTheme();
  const { data, mutate } = useSWR<{ institutions: Institution[] }>(
    "/api/plaid/institutions",
    fetcher
  );
  const { data: auditData } = useSWR<{ events: AuditEvent[] }>("/api/audit-log", fetcher);
  const { data: schedulerData, mutate: mutateScheduler } = useSWR<{
    syncScheduleEnabled: boolean;
    digestScheduleEnabled: boolean;
  }>("/api/settings/scheduler", fetcher);
  const [schedulerSaving, setSchedulerSaving] = useState(false);

  async function handleSchedulerToggle(field: "syncScheduleEnabled" | "digestScheduleEnabled", value: boolean) {
    setSchedulerSaving(true);
    try {
      await fetch("/api/settings/scheduler", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      mutateScheduler();
    } finally {
      setSchedulerSaving(false);
    }
  }

  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

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

  async function handleChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const currentPassword = fd.get("currentPassword") as string;
    const newPassword = fd.get("newPassword") as string;
    const confirmPassword = fd.get("confirmPassword") as string;

    if (!newPassword || newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error ?? "Failed to change password");
        return;
      }
      setPasswordSuccess(true);
      form.reset();
    } catch {
      setPasswordError("Failed to change password");
    }
  }

  const institutions = data?.institutions || [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Choose light or dark mode for the interface.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <ThemeToggle className="h-10 w-10" />
            <span className="text-sm text-muted-foreground">
              {theme === "dark" ? "Dark mode" : "Light mode"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Scheduled Jobs
          </CardTitle>
          <CardDescription>
            Control automatic background tasks. Changes take effect on the next scheduled run — no restart required.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sync-toggle" className="text-sm font-medium">
                Daily account sync
              </Label>
              <p className="text-xs text-muted-foreground">
                Pulls new transactions and balances from Plaid every day at 06:00.
              </p>
            </div>
            <Switch
              id="sync-toggle"
              checked={schedulerData?.syncScheduleEnabled ?? true}
              onCheckedChange={(v) => handleSchedulerToggle("syncScheduleEnabled", v)}
              disabled={schedulerSaving}
            />
          </div>
          <div className="border-t pt-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="digest-toggle" className="text-sm font-medium">
                Weekly AI digest
              </Label>
              <p className="text-xs text-muted-foreground">
                Generates a Gemini-written spending summary every Monday at 08:00.
              </p>
            </div>
            <Switch
              id="digest-toggle"
              checked={schedulerData?.digestScheduleEnabled ?? true}
              onCheckedChange={(v) => handleSchedulerToggle("digestScheduleEnabled", v)}
              disabled={schedulerSaving}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your dashboard login password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            {passwordError && (
              <p className="text-sm text-destructive">{passwordError}</p>
            )}
            {passwordSuccess && (
              <p className="text-sm text-green-600 dark:text-green-400">Password updated successfully.</p>
            )}
            <Button type="submit">Change Password</Button>
          </form>
        </CardContent>
      </Card>

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
                      <PlaidRelinkButton
                        institutionId={inst.id}
                        onSuccess={() => mutate()}
                      />
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Security Log
          </CardTitle>
          <CardDescription>
            Recent sensitive actions — last 100 events.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!auditData?.events?.length ? (
            <p className="text-muted-foreground text-sm">No events recorded yet.</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              {auditData.events.map((evt) => (
                <div key={evt.id} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium">
                      {ACTION_LABELS[evt.action] ?? evt.action}
                    </span>
                    {evt.metadata && typeof evt.metadata === "object" && "name" in evt.metadata && (
                      <span className="text-muted-foreground truncate text-xs">
                        {String((evt.metadata as Record<string, unknown>).name)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    {evt.ip && (
                      <span className="text-xs text-muted-foreground font-mono">{evt.ip}</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(evt.createdAt).toLocaleString()}
                    </span>
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
