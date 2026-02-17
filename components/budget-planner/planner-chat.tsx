"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import useSWR from "swr";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage, isToolUIPart, getToolName } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import * as Dialog from "@radix-ui/react-dialog";
import { Send, Sparkles, Save, RotateCcw, Loader2, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseBudgetTotal } from "@/lib/savings-targets";

const SAVINGS_SUGGESTIONS = [
  "If I save $200/month, when could I go?",
  "How much per month to afford this by next summer?",
  "Can I reach this saving $300/month?",
  "I can put away $500/month — how long until I can book?",
];

const SAVINGS_GOAL_SUGGESTIONS = [
  "Have $5,000 in savings by May",
  "Save $10k for an emergency fund by December",
  "Reach $3,000 in savings by end of year",
  "Have $2,500 saved by August",
];

const CUT_SPENDING_SUGGESTIONS = [
  "Tell me how I can cut spending",
  "How can I reduce my expenses?",
  "Ways to save money on my budget",
];

const VACATION_PLANNING_SUGGESTIONS = [
  "Plan a 1-week trip to Japan",
  "Budget for a European summer vacation",
  "2-week Southeast Asia backpacking trip",
  "Long weekend getaway to NYC",
];

const MAX_INPUT_LENGTH = 1000;

const TABLE_LINE = /[━─]{2,}/;

function splitBudgetEstimateSegments(text: string): { type: "table" | "markdown"; content: string }[] {
  const lines = text.split("\n");
  let firstTable = -1;
  let lastTable = -1;

  for (let i = 0; i < lines.length; i++) {
    if (TABLE_LINE.test(lines[i])) {
      if (firstTable < 0) firstTable = i;
      lastTable = i;
    }
  }

  if (firstTable < 0) {
    return [{ type: "markdown", content: text }];
  }

  const segments: { type: "table" | "markdown"; content: string }[] = [];

  if (firstTable > 0) {
    segments.push({
      type: "markdown",
      content: lines.slice(0, firstTable).join("\n").trim(),
    });
  }

  segments.push({
    type: "table",
    content: lines.slice(firstTable, lastTable + 1).join("\n"),
  });

  if (lastTable + 1 < lines.length) {
    segments.push({
      type: "markdown",
      content: lines.slice(lastTable + 1).join("\n").trim(),
    });
  }

  return segments.filter((s) => s.content.length > 0);
}

interface PlannerChatProps {
  initialMessages?: UIMessage[];
  readOnly?: boolean;
  onSaved?: () => void;
  planForSavings?: { title: string; summaryText: string | null; id?: string };
}

export function PlannerChat({ initialMessages, readOnly = false, onSaved, planForSavings }: PlannerChatProps) {
  const [inputValue, setInputValue] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/ai/budget-planner" }),
    []
  );

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport,
    messages: initialMessages,
  });

  const isStreaming = status === "streaming" || status === "submitted";

  const lastAssistantText = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === "assistant") {
        const textPart = msg.parts.findLast((p) => p.type === "text");
        if (textPart?.type === "text") return textPart.text;
      }
    }
    return "";
  }, [messages]);

  const summaryForSavings = planForSavings?.summaryText ?? (lastAssistantText.includes("BUDGET ESTIMATE:") ? lastAssistantText : null);
  const parsedTotal = parseBudgetTotal(summaryForSavings);
  const planTitle = planForSavings?.title ?? (() => {
    const firstUser = messages.find((m) => m.role === "user");
    return firstUser?.parts.find((p) => p.type === "text")?.text?.slice(0, 100) ?? "Budget Plan";
  })();
  const hasBudgetEstimate =
    (parsedTotal != null && parsedTotal > 0) ||
    (summaryForSavings != null && summaryForSavings.includes("BUDGET ESTIMATE:"));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Autosave when streaming completes and we have messages
  const prevStreamingRef = useRef(false);
  const autosaveLockRef = useRef(false);
  useEffect(() => {
    if (readOnly) return;
    const wasStreaming = prevStreamingRef.current;
    prevStreamingRef.current = isStreaming;

    if (wasStreaming && !isStreaming && messages.length > 0 && !autosaveLockRef.current) {
      autosaveLockRef.current = true;
      const firstUserMsg = messages.find((m) => m.role === "user");
      const title =
        firstUserMsg?.parts.find((p) => p.type === "text")?.text?.slice(0, 200) ??
        "Budget Plan";
      const summary =
        lastAssistantText.includes("BUDGET ESTIMATE:") ? lastAssistantText : undefined;

      const doSave = async () => {
        try {
          if (savedId) {
            await fetch(`/api/budget-plans/${savedId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title,
                messagesJson: messages,
                summaryText: summary ?? null,
              }),
            });
          } else {
            const res = await fetch("/api/budget-plans", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title,
                messagesJson: messages,
                summaryText: summary,
              }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data?.id) setSavedId(data.id);
            }
          }
          onSaved?.();
        } finally {
          autosaveLockRef.current = false;
        }
      };
      doSave();
    }
  }, [isStreaming, messages, readOnly, savedId, lastAssistantText, onSaved]);

  function handleReset() {
    setMessages([]);
    setSavedId(null);
    setInputValue("");
    setInputError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInputError(null);
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setInputError("Please describe what you want to budget.");
      return;
    }
    if (trimmed.length > MAX_INPUT_LENGTH) {
      setInputError(`Too long (max ${MAX_INPUT_LENGTH} characters).`);
      return;
    }
    const body =
      parsedTotal != null && parsedTotal > 0
        ? { budgetContext: { estimatedTotal: parsedTotal, planTitle } }
        : undefined;
    sendMessage({ text: trimmed }, body ? { body } : undefined);
    setInputValue("");
  }

  // ── Empty state (no messages yet) ─────────────────────────────────────────
  if (messages.length === 0 && !readOnly) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-8 px-6 py-12">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold text-foreground whitespace-nowrap">AI Budget Planner</h2>
            <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
              Beta
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-sm">
            Plan a trip, set a savings goal, or create a spending budget — just describe
            what you need in plain English.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-3">
          <textarea
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setInputError(null);
            }}
            placeholder="e.g. &quot;1-week trip to Japan, May 2027&quot; or &quot;have $5k in savings by June&quot;"
            rows={3}
            maxLength={MAX_INPUT_LENGTH}
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          {inputError && <p className="text-xs text-destructive">{inputError}</p>}
          <Button
            type="submit"
            disabled={isStreaming || !inputValue.trim()}
            className="w-full gap-2"
          >
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isStreaming ? "Sending…" : "Go →"}
          </Button>
        </form>

        <div className="space-y-4 w-full max-w-lg">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground text-center">Cut spending</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {CUT_SPENDING_SUGGESTIONS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => setInputValue(chip)}
                  className="text-xs px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/50 transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground text-center">Savings goals</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SAVINGS_GOAL_SUGGESTIONS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => setInputValue(chip)}
                  className="text-xs px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/50 transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground text-center">Plan a vacation</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {VACATION_PLANNING_SUGGESTIONS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => setInputValue(chip)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Conversation view ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/60 bg-card/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-muted-foreground gap-1.5 text-xs h-7"
          >
            <RotateCcw className="h-3 w-3" />
            New Plan
          </Button>

          <div className="flex items-center gap-2">
            {hasBudgetEstimate && (
              <SaveTowardButton
                planTitle={planTitle}
                targetAmount={parsedTotal ?? null}
                budgetPlanId={savedId ?? planForSavings?.id}
              />
            )}
            {savedId && (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Save className="h-3 w-3" />
                Saved ✓
              </span>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.map((msg) => (
          <PlannerMessage key={msg.id} message={msg} />
        ))}

        {isStreaming && messages.length > 0 &&
          (() => {
            const lastMsg = messages[messages.length - 1];
            const hasContent =
              lastMsg?.role === "assistant" &&
              lastMsg.parts.some((p) => p.type === "text" && p.text.length > 0);
            const hasResearchContent =
              hasContent &&
              lastMsg.parts.some((p) =>
                p.type === "text" &&
                (p.text.includes("Researching:") ||
                  p.text.includes("**Researching:**") ||
                  /Searching for .+\.\.\./i.test(p.text))
              );
            const hasPendingSearch =
              lastMsg?.role === "assistant" &&
              lastMsg.parts.some(
                (p) =>
                  isToolUIPart(p) &&
                  getToolName(p) === "webSearch" &&
                  p.state !== "output-available" &&
                  p.state !== "output-error"
              );

            if (!hasContent) {
              return (
                <div className="flex gap-2 justify-start">
                  <div className="bg-card border border-border/60 rounded-lg px-3 py-2">
                    <span className="text-muted-foreground text-sm flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
                      Thinking...
                    </span>
                  </div>
                </div>
              );
            }
            if (hasResearchContent || hasPendingSearch) {
              return (
                <div className="flex gap-2 justify-start">
                  <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />
                    <span className="text-primary text-xs font-medium">Researching...</span>
                  </div>
                </div>
              );
            }
            return null;
          })()}

        {error && (
          <div className="text-sm text-destructive px-2">
            {error.message || "Something went wrong. Please try again."}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input (hidden in readOnly mode) */}
      {!readOnly && (
        <form onSubmit={handleSubmit} className="border-t border-border/60 px-4 py-3">
          <div className="mb-2 flex flex-wrap gap-1.5 items-center">
            {hasBudgetEstimate && (
              <>
                <span className="text-xs text-muted-foreground mr-1 self-center">Ask about saving:</span>
                {SAVINGS_SUGGESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setInputValue(q)}
                    className="text-xs px-2.5 py-1 rounded-md border border-border/60 bg-muted/40 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-accent/50 transition-colors"
                  >
                    {q}
                  </button>
                ))}
                <span className="text-xs text-muted-foreground mx-1">·</span>
              </>
            )}
            <button
              type="button"
              onClick={() => setInputValue("Tell me how I can cut spending")}
              className="text-xs px-2.5 py-1 rounded-md border border-border/60 bg-muted/40 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-accent/50 transition-colors"
            >
              How can I cut spending?
            </button>
          </div>
          {inputError && <p className="text-xs text-destructive mb-1.5">{inputError}</p>}
          <div className="flex gap-2">
            <input
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setInputError(null);
              }}
              placeholder={hasBudgetEstimate ? "Ask about saving (e.g. 'if I save $300/month...')" : "Reply, or try 'how can I cut spending?'"}
              maxLength={MAX_INPUT_LENGTH}
              className="flex-1 h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              className="h-9 w-9 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isStreaming || !inputValue.trim()}
            >
              {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── PlannerMessage ─────────────────────────────────────────────────────────────

function PlannerMessage({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[88%] rounded-lg px-3 py-2.5 text-sm border",
          isUser
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-card text-foreground border-border/60"
        )}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            const text = part.text;
            if (!text) return null;

            if (isUser) {
              return (
                <div key={i} className="whitespace-pre-wrap break-words">
                  {text}
                </div>
              );
            }

            // Split: table blocks (box-drawing) → plain monospace; rest → markdown
            const hasTableBlock = text.includes("━━━") || text.includes("──────");
            if (hasTableBlock) {
              const segments = splitBudgetEstimateSegments(text);
              return (
                <div key={i} className="space-y-3">
                  {segments.map((seg, j) =>
                    seg.type === "table" ? (
                      <div
                        key={j}
                        className="font-mono text-xs leading-relaxed whitespace-pre-wrap break-words"
                      >
                        {seg.content}
                      </div>
                    ) : (
                      <div key={j} className="chat-markdown">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {seg.content}
                        </ReactMarkdown>
                      </div>
                    )
                  )}
                </div>
              );
            }

            const isResearchStage =
              text.includes("Researching:") ||
              text.includes("**Researching:**") ||
              /Searching for .+\.\.\./i.test(text);

            // Normalize legacy "Searching for X..." lines into markdown bullets
            let displayText = text;
            if (isResearchStage && /Searching for .+\.\.\./i.test(text) && !text.includes("- ")) {
              displayText = text.replace(
                /^Searching for (.+?)\.\.\.?$/gim,
                (_, content) => `- ${content.trim()}`
              );
              if (displayText !== text && !displayText.includes("**Researching:**")) {
                const firstBullet = displayText.search(/^- /m);
                if (firstBullet > 0) {
                  const before = displayText.slice(0, firstBullet).trimEnd();
                  const after = displayText.slice(firstBullet);
                  displayText = before + "\n\n**Researching:**\n\n" + after;
                }
              }
            }

            return (
              <div
                key={i}
                className={cn(
                  "chat-markdown",
                  isResearchStage && "research-stage"
                )}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayText}</ReactMarkdown>
              </div>
            );
          }

          if (isToolUIPart(part)) {
            const toolName = getToolName(part);
            if (toolName === "webSearch") {
              return (
                <div key={i} className="my-1">
                  <WebSearchBadge state={part.state} />
                </div>
              );
            }
            if (toolName === "savings_projection") {
              return (
                <div key={i} className="my-1">
                  <SavingsProjectionBadge state={part.state} />
                </div>
              );
            }
            if (toolName === "create_savings_target") {
              return (
                <div key={i} className="my-1">
                  <CreateSavingsTargetBadge state={part.state} />
                </div>
              );
            }
            if (toolName === "create_budget_goal") {
              return (
                <div key={i} className="my-1">
                  <CreateBudgetGoalBadge state={part.state} />
                </div>
              );
            }
            if (toolName === "get_spending_insights") {
              return (
                <div key={i} className="my-1">
                  <SpendingInsightsBadge state={part.state} />
                </div>
              );
            }
            return (
              <div key={i} className="my-1">
                <Badge variant="secondary" className="text-xs gap-1.5">
                  {part.state !== "output-available" && part.state !== "output-error" && (
                    <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
                  )}
                  {toolName}
                  {part.state === "output-available" && " ✓"}
                </Badge>
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}

function WebSearchBadge({ state }: { state: string }) {
  const isDone = state === "output-available" || state === "output-error";

  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-xs gap-1.5",
        isDone ? "opacity-70" : ""
      )}
    >
      {!isDone && (
        <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
      )}
      🔍 {isDone ? "Done ✓" : "Researching..."}
    </Badge>
  );
}

function SavingsProjectionBadge({ state }: { state: string }) {
  const isDone = state === "output-available" || state === "output-error";

  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-xs gap-1.5",
        isDone ? "opacity-70" : ""
      )}
    >
      {!isDone && (
        <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
      )}
      <Target className="h-3 w-3" />
      {isDone ? "Done ✓" : "Planning savings..."}
    </Badge>
  );
}

function CreateSavingsTargetBadge({ state }: { state: string }) {
  const isDone = state === "output-available" || state === "output-error";

  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-xs gap-1.5",
        isDone
          ? "opacity-70 bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
          : ""
      )}
    >
      {!isDone && (
        <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
      )}
      <Save className="h-3 w-3" />
      {isDone ? "Savings target created ✓" : "Creating savings target..."}
    </Badge>
  );
}

function CreateBudgetGoalBadge({ state }: { state: string }) {
  const isDone = state === "output-available" || state === "output-error";

  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-xs gap-1.5",
        isDone
          ? "opacity-70 bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
          : ""
      )}
    >
      {!isDone && (
        <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
      )}
      <Target className="h-3 w-3" />
      {isDone ? "Budget goal added ✓" : "Adding budget goal..."}
    </Badge>
  );
}

function SpendingInsightsBadge({ state }: { state: string }) {
  const isDone = state === "output-available" || state === "output-error";

  return (
    <Badge
      variant="secondary"
      className={cn("text-xs gap-1.5", isDone ? "opacity-70" : "")}
    >
      {!isDone && (
        <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
      )}
      {isDone ? "Spending analyzed ✓" : "Analyzing spending..."}
    </Badge>
  );
}

// ── SaveTowardButton ─────────────────────────────────────────────────────────

function SaveTowardButton({
  planTitle,
  targetAmount,
  budgetPlanId,
}: {
  planTitle: string;
  targetAmount: number | null;
  budgetPlanId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(planTitle.slice(0, 80));
  const [amount, setAmount] = useState(
    targetAmount != null ? String(Math.round(targetAmount)) : ""
  );
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 12);
    return d.toISOString().slice(0, 10);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(planTitle.slice(0, 80));
      setAmount(targetAmount != null ? String(Math.round(targetAmount)) : "");
      setError(null);
    }
  }, [open, planTitle, targetAmount]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const num = parseFloat(amount.replace(/,/g, ""));
      if (isNaN(num) || num <= 0) {
        setError("Enter a valid target amount.");
        return;
      }
      const res = await fetch("/api/savings-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || planTitle.slice(0, 80),
          targetAmount: num,
          targetDate,
          budgetPlanId: budgetPlanId || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to create");
      }
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-7"
        >
          <Target className="h-3 w-3" />
          Save toward this
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-lg">
          <Dialog.Title className="text-base font-semibold mb-1">
            Save toward this budget
          </Dialog.Title>
          <Dialog.Description className="text-sm text-muted-foreground mb-4">
            Create a savings target to track progress. You can view it on the dashboard.
          </Dialog.Description>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="st-name">Name</Label>
              <Input
                id="st-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Japan trip May 2027"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="st-amount">Target amount ($)</Label>
              <Input
                id="st-amount"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="st-date">Target date</Label>
              <Input
                id="st-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Creating…" : "Create target"}
              </Button>
              <Dialog.Close asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </Dialog.Close>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
