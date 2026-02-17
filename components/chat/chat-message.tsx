/**
 * Renders a single chat message — markdown for assistant, plain text for user.
 * Tool calls are shown as inline badges; the generate_report tool gets a download button.
 */
import { useState } from "react";
import { type UIMessage, isToolUIPart, getToolName } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { ToolCallBadge } from "./tool-call-badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface ChatMessageProps {
  message: UIMessage;
}

function ReportDownloadButton({ from, to }: { from: string; to: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to generate report");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `financial-report-${from}-to-${to}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-1 space-y-1">
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs gap-1.5"
        onClick={handleDownload}
        disabled={loading}
      >
        <Download className="h-3.5 w-3.5" />
        {loading ? "Generating PDF…" : `Download report (${from} → ${to})`}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm border",
          isUser
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-card text-foreground border-border/60"
        )}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            if (isUser) {
              return (
                <div key={i} className="whitespace-pre-wrap break-words">
                  {part.text}
                </div>
              );
            }
            return (
              <div key={i} className="chat-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {part.text}
                </ReactMarkdown>
              </div>
            );
          }

          if (isToolUIPart(part)) {
            const toolName = getToolName(part);

            // generateReport: render a real download button once ready
            if (
              toolName === "generate_report" &&
              part.state === "output-available"
            ) {
              const output = (part as { state: "output-available"; output: { from: string; to: string } }).output;
              return (
                <div key={i} className="my-1">
                  <ReportDownloadButton from={output.from} to={output.to} />
                </div>
              );
            }

            return (
              <div key={i} className="my-1">
                <ToolCallBadge toolName={toolName} state={part.state} />
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
