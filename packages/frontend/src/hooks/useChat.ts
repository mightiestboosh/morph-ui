import { useState, useCallback, useRef } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  surfaces?: UISurface[];
  isAction?: boolean;
  submittedData?: Record<string, unknown>;
}

export interface UISurface {
  surfaceId: string;
  componentTree: unknown;
}

export interface AgentLogEntry {
  timestamp: number;
  action: string;
  detail?: string;
}

export interface AgentStatus {
  jobId: string;
  label: string;
  status: 'running' | 'complete' | 'failed';
  progress?: number;
  message?: string;
  screenshot?: string; // base64 jpeg data URL
  logs: AgentLogEntry[];
  url?: string;
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

export function useChat(onTitleUpdate?: (conversationId: string, title: string) => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [surfaces, setSurfaces] = useState<Map<string, UISurface>>(new Map());
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>([]);
  const bufferRef = useRef('');
  const onTitleUpdateRef = useRef(onTitleUpdate);
  onTitleUpdateRef.current = onTitleUpdate;

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}`);
      const data = await res.json();
      const rawMessages = data.messages || [];

      // Reconstruct ChatMessage objects with surfaces
      const chatMessages: ChatMessage[] = rawMessages.map((msg: any) => {
        const cm: ChatMessage = {
          id: msg.id,
          role: msg.role,
          content: msg.content,
        };

        // Restore surfaces from stored a2uiSurfaces
        if (msg.a2uiSurfaces && Array.isArray(msg.a2uiSurfaces)) {
          cm.surfaces = msg.a2uiSurfaces.map((s: any) => ({
            surfaceId: s.surfaceId,
            componentTree: s.componentTree || s.tree || s.layout,
          }));
        }

        // Detect action messages
        if (msg.role === 'user') {
          try {
            const parsed = JSON.parse(msg.content);
            if (parsed.type === 'ui_action') {
              cm.isAction = true;
              cm.content = `Selected: ${parsed.action}`;
            }
          } catch {
            // Not JSON, regular message
          }
        }

        return cm;
      });

      // Mark surface messages as "submitted" if they were followed by a ui_action
      for (let i = 0; i < chatMessages.length; i++) {
        const msg = chatMessages[i];
        if (msg.role === 'assistant' && msg.surfaces?.length) {
          // Look for a subsequent ui_action from the user
          for (let j = i + 1; j < chatMessages.length; j++) {
            if (chatMessages[j].role === 'user' && chatMessages[j].isAction) {
              // Find the original action data
              try {
                const rawContent = rawMessages[j].content;
                const parsed = JSON.parse(rawContent);
                if (parsed.type === 'ui_action' && parsed.data) {
                  msg.submittedData = parsed.data;
                }
              } catch {
                msg.submittedData = {};
              }
              break;
            }
            if (chatMessages[j].role === 'assistant') break; // next assistant response, stop looking
          }
        }
      }

      setMessages(chatMessages);
      setSurfaces(new Map());
      setAgentStatuses([]);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }, []);

  const streamResponse = useCallback(async (
    conversationId: string,
    messageText: string,
    model: string,
  ) => {
    setIsLoading(true);
    setAgentStatuses([]);
    bufferRef.current = '';

    const assistantId = crypto.randomUUID();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, message: messageText, model }),
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
                componentTree: raw.componentTree || raw.tree || raw.layout,
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
              const label = raw.agent_label || raw.label || 'Browser Agent';
              const resolvedStatus = raw.status === 'completed' ? 'complete' : raw.status === 'failed' ? 'failed' : 'running';
              setAgentStatuses((prev) => {
                const idx = prev.findIndex((s) => s.label === label);
                const existing = idx >= 0 ? prev[idx] : null;

                // Build log entry if there's a meaningful status change
                const newLogs = [...(existing?.logs || [])];
                if (raw.log) {
                  newLogs.push({ timestamp: Date.now(), action: raw.log, detail: raw.log_detail });
                } else if (raw.message && (!existing || existing.message !== raw.message)) {
                  newLogs.push({ timestamp: Date.now(), action: raw.message });
                }

                const updated: AgentStatus = {
                  jobId: raw.jobId || label || 'unknown',
                  label,
                  status: resolvedStatus,
                  progress: raw.progress,
                  message: raw.message,
                  screenshot: raw.screenshot || existing?.screenshot,
                  logs: newLogs,
                  url: raw.url || existing?.url,
                };

                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = updated;
                  return next;
                }
                return [...prev, updated];
              });
              break;
            }
            case 'title_update': {
              const parsed = JSON.parse(evt.data);
              if (parsed.title && onTitleUpdateRef.current) {
                onTitleUpdateRef.current(parsed.conversationId, parsed.title);
              }
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
    await streamResponse(conversationId, text, model);
  }, [streamResponse]);

  const sendAction = useCallback(async (
    conversationId: string,
    action: string,
    data: Record<string, unknown>,
    model: string,
  ) => {
    // Collapse the most recent surface message by marking it as submitted
    setMessages((prev) => {
      const updated = [...prev];
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].role === 'assistant' && updated[i].surfaces?.length) {
          updated[i] = { ...updated[i], submittedData: data };
          break;
        }
      }
      return updated;
    });

    const messageText = JSON.stringify({ type: 'ui_action', action, data });
    await streamResponse(conversationId, messageText, model);
  }, [streamResponse]);

  const editSubmission = useCallback(async (
    conversationId: string,
    messageId: string,
  ) => {
    // Find the submitted assistant message and revert: remove all messages after it,
    // clear its submittedData so the surface renders as interactive again
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === messageId);
      if (idx < 0) return prev;

      // Keep messages up to and including this one, restore its surface
      const kept = prev.slice(0, idx + 1);
      const target = { ...kept[idx] };
      delete target.submittedData;
      kept[idx] = target;
      return kept;
    });

    // Delete messages after this point from the DB so re-submission flows cleanly
    try {
      await fetch(`/api/conversations/${conversationId}/revert/${messageId}`, {
        method: 'POST',
      });
    } catch (err) {
      console.error('Failed to revert conversation on server:', err);
    }
  }, []);

  return { messages, isLoading, surfaces, agentStatuses, sendMessage, sendAction, loadMessages, editSubmission };
}
