"use client";

import { useState, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface PlaidLinkButtonProps {
  onSuccess?: () => void;
}

export function PlaidLinkButton({ onSuccess }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchLinkToken() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plaid/link-token", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create Plaid link token");
        return;
      }
      if (data.link_token) {
        setLinkToken(data.link_token);
      } else {
        setError("Plaid did not return a link token.");
      }
    } catch {
      setError("Network error while preparing Plaid Link.");
    } finally {
      setLoading(false);
    }
  }

  const handleOnSuccess = useCallback(
    async (publicToken: string) => {
      setError(null);
      try {
        const res = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token: publicToken }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Failed to connect institution");
          return;
        }
        onSuccess?.();
      } catch {
        setError("Network error while connecting institution.");
      }
    },
    [onSuccess]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleOnSuccess,
  });

  if (!linkToken) {
    return (
      <div className="space-y-2">
        <Button onClick={fetchLinkToken} disabled={loading}>
          <Plus className="h-4 w-4 mr-2" />
          {loading ? "Preparing..." : "Link New Account"}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button onClick={() => open()} disabled={!ready}>
        <Plus className="h-4 w-4 mr-2" />
        Connect Institution
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
