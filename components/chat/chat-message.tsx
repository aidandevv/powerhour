/**
 * CHAT-02/03: Renders a single chat message with text parts and tool call badges
 */
import { type UIMessage, isToolUIPart, getToolName } from "ai";
import { cn } from "@/lib/utils";
import { ToolCallBadge } from "./tool-call-badge";

interface ChatMessageProps {
  message: UIMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return (
              <div key={i} className="whitespace-pre-wrap break-words">
                {part.text}
              </div>
            );
          }

          if (isToolUIPart(part)) {
            return (
              <div key={i} className="my-1">
                <ToolCallBadge
                  toolName={getToolName(part)}
                  state={part.state}
                />
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
