"use client";

/** Collapsible floating chat panel for non-dashboard pages. */
import { useState } from "react";
import { ChatPanel } from "./chat-panel";
import { MessageCircle } from "lucide-react";
import { useAiStatus } from "@/components/ai/provider-status";

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const { data } = useAiStatus();

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-card hover:bg-primary/90 transition-colors"
        aria-label={data?.beta ? "Open Ticker (local model beta)" : "Open Ticker"}
      >
        <MessageCircle className="h-5 w-5" />
        {data?.beta && <span className="absolute -top-2 rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-900">Beta</span>}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[380px] transition-all duration-200">
      <ChatPanel
        variant="floating"
        onClose={() => setIsOpen(false)}
        showClose={true}
        className="h-[520px] shadow-card-hover"
      />
    </div>
  );
}
