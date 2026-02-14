/**
 * PDF-01: Dashboard button to generate a PDF report for a selected date range
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Loader2 } from "lucide-react";

export function ReportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default: current month
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const today = now.toISOString().split("T")[0];

  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);

  async function handleGenerate() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to generate report" }));
        throw new Error(data.error || `Error ${res.status}`);
      }

      // Download the PDF
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `financial-report-${from}-to-${to}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setIsOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) {
    return (
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <FileText className="h-4 w-4 mr-1.5" />
        Generate Report
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 text-sm">
        <label className="text-muted-foreground">From</label>
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="h-8 w-36 text-xs"
        />
        <label className="text-muted-foreground">To</label>
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-8 w-36 text-xs"
        />
      </div>
      <Button size="sm" onClick={handleGenerate} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <FileText className="h-3.5 w-3.5 mr-1" />
            Download PDF
          </>
        )}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
        Cancel
      </Button>
      {error && <p className="text-xs text-destructive w-full">{error}</p>}
    </div>
  );
}
