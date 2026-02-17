"use client";

import { useState, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import { Link as LinkIcon } from "lucide-react";

interface PlaidRelinkButtonProps {
  institutionId: string;
  onSuccess?: () => void;
}

export function PlaidRelinkButton({ institutionId, onSuccess }: PlaidRelinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchRelinkToken() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/plaid/institutions/${institutionId}/relink`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.link_token) {
        setLinkToken(data.link_token);
      } else {
        setError(data.error ?? "Failed to get relink token");
      }
    } catch {
      setError("Failed to initiate relink");
    } finally {
      setLoading(false);
    }
  }

  const handleOnSuccess = useCallback(
    async (publicToken: string) => {
      try {
        const res = await fetch("/api/plaid/exchange-relink", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_token: publicToken,
            institution_id: institutionId,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Relink failed");
        }
        setLinkToken(null);
        onSuccess?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Relink failed");
      }
    },
    [institutionId, onSuccess]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleOnSuccess,
  });

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled>
        Preparing...
      </Button>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={fetchRelinkToken}>
          <LinkIcon className="h-4 w-4 mr-1" />
          Retry Relink
        </Button>
        <span className="text-xs text-destructive">{error}</span>
      </div>
    );
  }

  if (!linkToken) {
    return (
      <Button variant="outline" size="sm" onClick={fetchRelinkToken}>
        <LinkIcon className="h-4 w-4 mr-1" />
        Relink
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => open()}
      disabled={!ready}
    >
      <LinkIcon className="h-4 w-4 mr-1" />
      Reconnect
    </Button>
  );
}
