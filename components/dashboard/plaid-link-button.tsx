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

  async function fetchLinkToken() {
    setLoading(true);
    try {
      const res = await fetch("/api/plaid/link-token", { method: "POST" });
      const data = await res.json();
      if (data.link_token) {
        setLinkToken(data.link_token);
      }
    } catch {
      console.error("Failed to create link token");
    } finally {
      setLoading(false);
    }
  }

  const handleOnSuccess = useCallback(
    async (publicToken: string) => {
      try {
        await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token: publicToken }),
        });
        onSuccess?.();
      } catch {
        console.error("Failed to exchange token");
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
      <Button onClick={fetchLinkToken} disabled={loading}>
        <Plus className="h-4 w-4 mr-2" />
        {loading ? "Preparing..." : "Link New Account"}
      </Button>
    );
  }

  return (
    <Button onClick={() => open()} disabled={!ready}>
      <Plus className="h-4 w-4 mr-2" />
      Connect Institution
    </Button>
  );
}
