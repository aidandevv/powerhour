"use client";

/**
 * CHAT-01: Collapsible chat widget embedded in the dashboard
 * CHAT-02: Streaming text display with typing indicator
 * CHAT-04: Conversation history preserved within session
 * CHAT-05: Input validation (empty/oversized messages)
 * AGNT-03: Session-scoped conversation context via useChat messages
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

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/ai/chat" }),
    []
  );

  const { messages, sendMessage, status, error } = useChat({
    transport,
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  function handleSubmit(e: React.FormEvent) {
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

    sendMessage({ text: trimmed });
    setInputValue("");
  }

  return (
    <>
      {/* Toggle button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
          aria-label="Open chat"
        >
          <MessageCircle className="h-5 w-5" />
        </button>
      )}

      {/* Chat panel */}
      <div
        className={cn(
          "fixed bottom-6 right-6 z-50 flex flex-col rounded-lg border bg-background shadow-xl transition-all duration-200",
          isOpen
            ? "w-[380px] h-[520px] opacity-100"
            : "w-0 h-0 opacity-0 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Financial Assistant</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              Ask me about your spending, balances, or transactions.
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {isStreaming && messages.length > 0 && (
            (() => {
              const lastMsg = messages[messages.length - 1];
              const hasContent = lastMsg?.role === "assistant" && lastMsg.parts.some(
                (p) => p.type === "text" && p.text.length > 0
              );
              return !hasContent ? <TypingIndicator /> : null;
            })()
          )}

          {error && (
            <div className="text-sm text-destructive px-2">
              {error.message || "Something went wrong. Please try again."}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="border-t px-3 py-3">
          {inputError && (
            <p className="text-xs text-destructive mb-1.5">{inputError}</p>
          )}
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setInputError(null);
              }}
              placeholder="Ask about your finances..."
              className="h-9 text-sm"
              maxLength={MAX_MESSAGE_LENGTH}
              disabled={isStreaming}
            />
            <Button
              type="submit"
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={isStreaming}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
