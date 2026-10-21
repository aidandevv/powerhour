import type {
  StreamTextTransform,
  TextStreamPart,
  ToolSet,
  UIMessage,
} from "ai";
import type { PiiMasker } from "./pii-masker";

type ExecutableTool = {
  execute?: (input: unknown, options?: unknown) => Promise<unknown> | unknown;
};

export function maskUserMessages(messages: UIMessage[], masker: PiiMasker): UIMessage[] {
  return messages.map((message) => {
    if (message.role !== "user") {
      return message;
    }

    return {
      ...message,
      parts: message.parts.map((part) =>
        part.type === "text"
          ? { ...part, text: masker.maskText(part.text) }
          : part
      ),
    };
  });
}

export function wrapToolsWithMasker<TOOLS extends ToolSet>(
  tools: TOOLS,
  masker: PiiMasker
): TOOLS {
  const wrappedEntries = Object.entries(tools).map(([name, toolDefinition]) => {
    const executableTool = toolDefinition as TOOLS[keyof TOOLS] & ExecutableTool;
    if (!executableTool.execute) {
      return [name, toolDefinition];
    }

    return [
      name,
      {
        ...toolDefinition,
        execute: async (input: unknown, options?: unknown) =>
          executableTool.execute?.(
            masker.unmaskToolInput(name, (input as Record<string, unknown>) ?? {}),
            options
          ),
      },
    ];
  });

  return Object.fromEntries(wrappedEntries) as TOOLS;
}

export function createPiiTransform<TOOLS extends ToolSet>(
  masker: PiiMasker
): StreamTextTransform<TOOLS> {
  return () => {
    let textBuffer = "";
    let lastTextId: string | undefined;

    const flushBufferedText = (
      controller: TransformStreamDefaultController<TextStreamPart<TOOLS>>
    ) => {
      if (textBuffer.length === 0) {
        return;
      }

      controller.enqueue({
        type: "text-delta",
        id: lastTextId ?? "pii-buffer-flush",
        text: masker.unmaskText(textBuffer),
      } as TextStreamPart<TOOLS>);
      textBuffer = "";
    };

    return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(chunk, controller) {
        if (chunk.type !== "text-delta" && textBuffer.length > 0) {
          flushBufferedText(controller);
        }

        if (chunk.type === "tool-result") {
          controller.enqueue({
            ...chunk,
            output: masker.maskToolResult(chunk.output),
          });
          return;
        }

        if (chunk.type === "text-delta") {
          lastTextId = chunk.id;
          const combined = textBuffer + chunk.text;
          const { flushed, buffered } = masker.splitBufferedText(combined);
          textBuffer = buffered;

          if (flushed.length > 0) {
            controller.enqueue({
              ...chunk,
              text: masker.unmaskText(flushed),
            });
          }
          return;
        }

        if (chunk.type === "reasoning-delta") {
          controller.enqueue({
            ...chunk,
            text: masker.unmaskText(chunk.text),
          } as TextStreamPart<TOOLS>);
          return;
        }

        controller.enqueue(chunk);
      },
      flush(controller) {
        flushBufferedText(controller);
      },
    });
  };
}
