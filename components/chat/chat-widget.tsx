"use client";

/** Collapsible floating chat panel for non-dashboard pages. */
import { useState } from "react";
import { ChatPanel } from "./chat-panel";
import { MessageCircle } from "lucide-react";

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-card hover:bg-primary/90 transition-colors"
        aria-label="Open Ticker"
      >
        <MessageCircle className="h-5 w-5" />
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
