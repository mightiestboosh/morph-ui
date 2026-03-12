import { useEffect, useRef } from 'react';
import { useChat } from '@/hooks/useChat';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { AgentStatusPanel } from './AgentStatusPanel';

interface ChatViewProps {
  conversationId: string | null;
  model: string;
}

export function ChatView({ conversationId, model }: ChatViewProps) {
  const { messages, isLoading, agentStatuses, sendMessage, loadMessages } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const handleSend = (text: string) => {
    if (!conversationId) return;
    sendMessage(conversationId, text, model);
  };

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">No conversation selected</p>
          <p className="text-sm mt-1">Create a new chat to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="flex items-center justify-center h-full min-h-[200px] text-muted-foreground">
              <p className="text-sm">Send a message to start the conversation</p>
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {agentStatuses.length > 0 && (
            <AgentStatusPanel statuses={agentStatuses} />
          )}
          {isLoading && agentStatuses.length === 0 && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm pl-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>Thinking...</span>
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-border bg-background px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <ChatInput onSend={handleSend} disabled={isLoading} />
        </div>
      </div>
    </div>
  );
}
