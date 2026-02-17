"use client";

/**
 * Shared chat panel UI - used by both floating ChatWidget and embedded dashboard panel
 */
import { useState, useRef, useEffect, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessage } from "./chat-message";
import { TypingIndicator } from "./typing-indicator";
import { MessageCircle, X, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_MESSAGE_LENGTH = 500;

// Quick actions temporarily disabled - debugging issues
// const QUICK_ACTIONS = [
//   "How much did I spend last month?",
//   "Will I have enough for bills?",
//   "List my recurring expenses",
//   "What's my net worth?",
//   "Audit my subscriptions",
// ];

interface ChatPanelProps {
  variant?: "floating" | "embedded";
  onClose?: () => void;
  showClose?: boolean;
  showQuickActions?: boolean;
  className?: string;
}

export function ChatPanel({ variant = "floating", onClose, showClose = true, showQuickActions = false, className }: ChatPanelProps) {
  const [inputValue, setInputValue] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/ai/chat" }),
    []
  );

  const { messages, sendMessage, status, error } = useChat({ transport });

  const isStreaming = status === "streaming" || status === "submitted";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInputError(null);
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setInputError("Please enter a message.");
      return;
    }
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      setInputError(`Message too long (max ${MAX_MESSAGE_LENGTH} characters).`);
      return;
    }
    try {
      await sendMessage({ text: trimmed });
      setInputValue("");
    } catch (err) {
      console.error("[chat] Send message error:", err);
      setInputError("Failed to send message. Please try again.");
    }
  }

  async function handleQuickAction(text: string) {
    try {
      await sendMessage({ text });
    } catch (err) {
      console.error("[chat] Quick action error:", err);
    }
  }

  const isEmbedded = variant === "embedded";

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border border-border/60 bg-card shadow-card overflow-hidden",
        isEmbedded ? "min-h-[400px]" : "h-[520px]",
        className
      )}
    >
      {/* Header - primary background for embedded like the reference image */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3",
          isEmbedded ? "bg-primary" : "border-b border-border/60"
        )}
      >
        <div className="flex items-center gap-2">
          <MessageCircle
            className={cn("h-4 w-4", isEmbedded ? "text-primary-foreground" : "text-primary")}
          />
          <span
            className={cn(
              "font-medium text-sm",
              isEmbedded ? "text-primary-foreground" : "text-foreground"
            )}
          >
            Ticker
          </span>
        </div>
        {showClose && onClose ? (
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7", isEmbedded ? "text-primary-foreground hover:bg-primary-foreground/20" : "")}
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-[200px]">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            Ask Ticker about your spending, balances, or transactions.
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {isStreaming && messages.length > 0 &&
          (() => {
            const lastMsg = messages[messages.length - 1];
            const hasContent =
              lastMsg?.role === "assistant" &&
              lastMsg.parts.some((p) => p.type === "text" && p.text.length > 0);
            return !hasContent ? <TypingIndicator /> : null;
          })()}

        {error && (
          <div className="text-sm text-destructive px-2 py-2">
            {error.message || "Something went wrong. Please try again."}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-border/60 px-3 py-3">
        {/* Quick actions temporarily disabled
        {showQuickActions && messages.length === 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {QUICK_ACTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleQuickAction(q)}
                disabled={isStreaming}
                className="text-xs px-2.5 py-1 rounded-md border border-border/60 bg-muted/40 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-accent/50 transition-colors disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        */}
        {inputError && <p className="text-xs text-destructive mb-1.5">{inputError}</p>}
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setInputError(null);
            }}
            placeholder="Enter query..."
            className="h-9 text-sm"
            maxLength={MAX_MESSAGE_LENGTH}
            disabled={isStreaming}
          />
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={isStreaming}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
