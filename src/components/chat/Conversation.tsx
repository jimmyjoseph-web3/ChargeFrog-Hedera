"use client";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Confirmation,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRequest,
  ConfirmationTitle,
} from "@/components/ai-elements/confirmation";
import { BatteryCharging, ChevronRight, MessageSquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import RawOutputDialog from "@/components/chat/RawOutputDialog";

export type DemoChatMessage = {
  id: string;
  confirmationAfterReply?: boolean;
  role: "user" | "assistant";
  content: string;
  reasoningSteps?: string[];
  postConfirmationReasoningSteps?: string[];
  reasoningText?: string;
  currentReasoningStep?: number;
  currentReasoningChar?: number;
  isReasoningReady?: boolean;
  reply?: string;
  rawOutput?: Record<string, unknown>;
  card?: {
    type: "investable-station";
    badge: string;
    stationName: string;
    ctaLabel: string;
  };
  confirmation?: {
    title: string;
    approveLabel: string;
    rejectLabel: string;
  };
  confirmationState?:
    | "approval-requested"
    | "approval-responded"
    | "output-denied";
  awaitingConfirmation?: boolean;
};

interface MockChatConversationProps {
  messages: DemoChatMessage[];
  isRunning?: boolean;
  onApproveConfirmation?: (messageId: string) => void;
  onRejectConfirmation?: (messageId: string) => void;
}

function AssistantStationCard({
  badge,
  stationName,
  ctaLabel,
}: {
  badge: string;
  stationName: string;
  ctaLabel: string;
}) {
  return (
    <div className="w-full rounded-3xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
          <BatteryCharging className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-500">
            {badge}
          </div>

          <h3 className="mt-3 text-base font-semibold text-zinc-950">
            {stationName}
          </h3>
        </div>
      </div>

      <Button className="mt-4 h-10 w-full rounded-2xl">
        <span>{ctaLabel}</span>
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}

function AssistantConfirmation({
  title,
  approveLabel,
  rejectLabel,
  onApprove,
  onReject,
}: {
  title: string;
  approveLabel: string;
  rejectLabel: string;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="w-full max-w-2xl">
      <Confirmation
        approval={{ id: "mock-confirmation" }}
        state="approval-requested"
      >
        <ConfirmationTitle>
          <ConfirmationRequest>{title}</ConfirmationRequest>
        </ConfirmationTitle>
        <ConfirmationActions>
          <ConfirmationAction onClick={onReject} variant="outline">
            {rejectLabel}
          </ConfirmationAction>
          <ConfirmationAction onClick={onApprove} variant="default">
            {approveLabel}
          </ConfirmationAction>
        </ConfirmationActions>
      </Confirmation>
    </div>
  );
}

export default function MockChatConversation({
  messages,
  isRunning = false,
  onApproveConfirmation,
  onRejectConfirmation,
}: MockChatConversationProps) {
  return (
    <Conversation className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      <ConversationContent className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-300/60 hover:scrollbar-thumb-zinc-400/80 px-3">
        {messages.length === 0 ? (
          <ConversationEmptyState
            description="Messages will appear here as the conversation progresses."
            icon={<MessageSquareIcon className="size-6" />}
            title="Start a conversation"
          />
        ) : (
          messages.map((message) => {
            const totalSteps = message.reasoningSteps?.length ?? 0;
            const currentStep = message.currentReasoningStep ?? 0;
            const isMessageStreaming =
              isRunning &&
              message.role === "assistant" &&
              currentStep < totalSteps;

            return (
              <Message from={message.role} key={message.id}>
                <div className="w-full space-y-3">
                  {message.role === "assistant" && message.reasoningText ? (
                    <Reasoning
                      className="w-full"
                      isStreaming={isMessageStreaming}
                    >
                      <ReasoningTrigger />
                      <ReasoningContent>
                        {message.reasoningText}
                      </ReasoningContent>
                    </Reasoning>
                  ) : null}

                  {message.content ? (
                    <MessageContent>
                      {message.role === "assistant" ? (
                        <MessageResponse>{message.content}</MessageResponse>
                      ) : (
                        message.content
                      )}
                    </MessageContent>
                  ) : null}

                  {message.role === "assistant" &&
                  message.confirmation &&
                  message.awaitingConfirmation &&
                  message.confirmationState === "approval-requested" ? (
                    <AssistantConfirmation
                      approveLabel={message.confirmation.approveLabel}
                      rejectLabel={message.confirmation.rejectLabel}
                      title={message.confirmation.title}
                      onApprove={() => onApproveConfirmation?.(message.id)}
                      onReject={() => onRejectConfirmation?.(message.id)}
                    />
                  ) : null}

                  {message.role === "assistant" &&
                  message.content &&
                  message.card ? (
                    <AssistantStationCard
                      badge={message.card.badge}
                      ctaLabel={message.card.ctaLabel}
                      stationName={message.card.stationName}
                    />
                  ) : null}

                  {message.role === "assistant" &&
                  message.content &&
                  message.rawOutput ? (
                    <RawOutputDialog rawOutput={message.rawOutput} />
                  ) : null}
                </div>
              </Message>
            );
          })
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
