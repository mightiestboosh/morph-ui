import { useState, useCallback, useRef } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  surfaces?: UISurface[];
}

export interface UISurface {
  surfaceId: string;
  componentTree: unknown;
}

export interface AgentStatus {
  jobId: string;
  label: string;
  status: 'running' | 'complete' | 'failed';
  progress?: number;
  message?: string;
}

interface SSEEvent {
  event: string;
  data: string;
}

function parseSSE(text: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const blocks = text.split('\n\n');
  for (const block of blocks) {
    if (!block.trim()) continue;
    let event = 'message';
    let data = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        data += line.slice(5).trim();
      }
    }
    if (data) {
      events.push({ event, data });
    }
  }
  return events;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [surfaces, setSurfaces] = useState<Map<string, UISurface>>(new Map());
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>([]);
  const bufferRef = useRef('');

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}`);
      const data = await res.json();
      setMessages(data.messages || []);
      setSurfaces(new Map());
      setAgentStatuses([]);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }, []);

  const sendMessage = useCallback(async (
    conversationId: string,
    text: string,
    model: string,
  ) => {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setAgentStatuses([]);
    bufferRef.current = '';

    const assistantId = crypto.randomUUID();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, message: text, model }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Chat request failed: ${res.status}`);
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let assistantContent = '';

      // Add empty assistant message to start streaming into
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        bufferRef.current += value;
        const events = parseSSE(bufferRef.current);

        // Keep any trailing incomplete block in the buffer
        const lastDoubleNewline = bufferRef.current.lastIndexOf('\n\n');
        if (lastDoubleNewline !== -1) {
          bufferRef.current = bufferRef.current.slice(lastDoubleNewline + 2);
        }

        for (const evt of events) {
          switch (evt.event) {
            case 'text': {
              const parsed = JSON.parse(evt.data);
              assistantContent += parsed.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: assistantContent } : m
                )
              );
              break;
            }
            case 'ui_surface': {
              const raw = JSON.parse(evt.data);
              const surface: UISurface = {
                surfaceId: raw.surfaceId,
                componentTree: raw.tree || raw.layout || raw.componentTree,
              };
              setSurfaces((prev) => new Map(prev).set(surface.surfaceId, surface));
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, surfaces: [...(m.surfaces || []), surface] }
                    : m
                )
              );
              break;
            }
            case 'agent_status': {
              const raw = JSON.parse(evt.data);
              const status: AgentStatus = {
                jobId: raw.jobId || raw.agent_label || raw.label || 'unknown',
                label: raw.agent_label || raw.label || 'Browser Agent',
                status: raw.status === 'completed' ? 'complete' : raw.status === 'failed' ? 'failed' : 'running',
                progress: raw.progress,
                message: raw.message,
              };
              setAgentStatuses((prev) => {
                const idx = prev.findIndex((s) => s.label === status.label);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = status;
                  return next;
                }
                return [...prev, status];
              });
              break;
            }
            case 'done': {
              setIsLoading(false);
              break;
            }
            case 'error': {
              const parsed = JSON.parse(evt.data);
              console.error('Stream error:', parsed.message);
              setIsLoading(false);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: assistantContent + `\n\n_Error: ${parsed.message}_` }
                    : m
                )
              );
              break;
            }
          }
        }
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Failed to send message:', err);
      setIsLoading(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: '_Failed to get a response. Please try again._' }
            : m
        )
      );
    }
  }, []);

  return { messages, isLoading, surfaces, agentStatuses, sendMessage, loadMessages };
}
