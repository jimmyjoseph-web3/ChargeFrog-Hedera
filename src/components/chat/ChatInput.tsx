"use client";

import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { useCallback, useState } from "react";

export interface ChatInputProps {
  onSubmit?: (message: PromptInputMessage) => void;
}

export function ChatInput({ onSubmit }: ChatInputProps) {
  const [status, setStatus] = useState<
    "submitted" | "streaming" | "ready" | "error"
  >("ready");

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const hasText = Boolean(message.text?.trim());
      const hasAttachments = Boolean(message.files?.length);

      if (!(hasText || hasAttachments)) return;

      setStatus("submitted");
      onSubmit?.(message);
      setTimeout(() => setStatus("ready"), 300);
    },
    [onSubmit]
  );

  return (
    <PromptInputProvider>
      <PromptInput
        globalDrop
        multiple
        onSubmit={handleSubmit}
        className="w-full  bg-white"
      >
        <PromptInputBody className="px-4 pt-3">
          <PromptInputTextarea
            placeholder="Ask ChargeFrog AI..."
            className="min-h-[52px] text-[15px] leading-6 placeholder:text-zinc-400"
          />
        </PromptInputBody>

        <PromptInputFooter className="px-3 pb-3">
          <div className="ml-auto">
            <PromptInputSubmit status={status} />
          </div>
        </PromptInputFooter>
      </PromptInput>
    </PromptInputProvider>
  );
}

export default ChatInput;