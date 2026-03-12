import { useEffect, useRef, useCallback } from 'react';
import { useChat } from '@/hooks/useChat';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { AgentStatusPanel } from './AgentStatusPanel';
import { MorphLogo } from '@/components/MorphLogo';
import type { FormHandle } from '../a2ui/DynamicRenderer';

interface ChatViewProps {
  conversationId: string | null;
  model: string;
  onConversationUpdated?: (conversationId?: string, title?: string) => void;
}

export function ChatView({ conversationId, model, onConversationUpdated }: ChatViewProps) {
  const handleTitleUpdate = useCallback((convId: string, title: string) => {
    onConversationUpdated?.(convId, title);
  }, [onConversationUpdated]);

  const { messages, isLoading, agentStatuses, sendMessage, sendAction, loadMessages, editSubmission } = useChat(handleTitleUpdate);
  const scrollRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<FormHandle>(null);

  // Find the last assistant message with surfaces for voice-to-UI
  const lastSurfaceMessage = [...messages].reverse().find(
    (m) => m.role === 'assistant' && m.surfaces && m.surfaces.length > 0
  );

  const handleVoiceResult = useCallback(async (transcript: string) => {
    if (!conversationId) return;

    // If there are active UI surfaces, try to interpret as UI command first
    if (formRef.current && lastSurfaceMessage) {
      const controls = formRef.current.getControls();
      if (controls.length > 0) {
        try {
          const res = await fetch('/api/voice-command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript, controls }),
          });
          const result = await res.json();
          if (result.understood && result.mutations?.length > 0) {
            for (const mutation of result.mutations) {
              formRef.current.setValue(mutation.id, mutation.value);
            }
            return; // UI updated, don't send as chat message
          }
        } catch (err) {
          console.error('Voice command failed, falling back to chat:', err);
        }
      }
    }

    // Fall back to sending as regular chat message
    sendMessage(conversationId, transcript, model);
  }, [conversationId, model, sendMessage, lastSurfaceMessage]);

  const { isListening, interimTranscript, isSupported, toggleListening } = useVoiceInput({
    onResult: handleVoiceResult,
  });

  useEffect(() => {
    if (conversationId) {
      loadMessages(conversationId);
    }
  }, [conversationId, loadMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, agentStatuses]);

  // (Title refresh now handled via SSE title_update event in useChat)

  const handleSend = (text: string) => {
    if (!conversationId) return;
    sendMessage(conversationId, text, model);
  };

  const handleAction = (action: string, data: Record<string, unknown>) => {
    if (!conversationId) return;
    sendAction(conversationId, action, data, model);
  };

  const handleEdit = (messageId: string) => {
    if (!conversationId) return;
    editSubmission(conversationId, messageId);
  };

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground bg-mesh">
        <div className="text-center flex flex-col items-center">
          <MorphLogo size={48} />
          <p className="text-2xl font-semibold text-foreground/80 mt-3">Morph</p>
          <p className="text-sm mt-2 text-muted-foreground">Create a new chat to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative min-h-0 bg-mesh">
      <div ref={scrollRef} className="absolute inset-0 overflow-y-auto">
        <div className="px-6 pt-8 pb-24 space-y-6">
          {messages.length === 0 && !isLoading && (
            <div className="flex items-center justify-center min-h-[300px] text-muted-foreground">
              <div className="text-center flex flex-col items-center">
                <MorphLogo size={48} />
                <p className="text-2xl font-semibold text-foreground/80 mt-3">What can I help with?</p>
                <p className="text-sm mt-2">Ask me anything or describe a task</p>
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              onAction={handleAction}
              onEdit={handleEdit}
              formRef={msg === lastSurfaceMessage ? formRef : undefined}
            />
          ))}
          {agentStatuses.length > 0 && (
            <AgentStatusPanel statuses={agentStatuses} />
          )}
          {isLoading && agentStatuses.length === 0 && (
            <div className="py-2 flex items-center gap-3">
              <MorphLogo size={24} speed={3} />
              <span className="text-sm text-muted-foreground">Morph is thinking...</span>
            </div>
          )}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 pt-2 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-auto">
          <ChatInput
            onSend={handleSend}
            disabled={isLoading}
            isListening={isListening}
            interimTranscript={interimTranscript}
            onToggleVoice={toggleListening}
            voiceSupported={isSupported}
          />
        </div>
      </div>
    </div>
  );
}
