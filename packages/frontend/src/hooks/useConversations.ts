import { useState, useEffect, useCallback } from 'react';

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const refreshConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      const data: Conversation[] = await res.json();
      setConversations(data);
    } catch (err) {
      console.error('Failed to refresh conversations:', err);
    }
  }, []);

  // Load on mount; auto-create a chat if none exist
  useEffect(() => {
    fetch('/api/conversations')
      .then((r) => r.json())
      .then(async (data: Conversation[]) => {
        if (data.length === 0) {
          // No conversations — create one automatically
          const res = await fetch('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });
          const conv: Conversation = await res.json();
          setConversations([conv]);
          setActiveId(conv.id);
        } else {
          setConversations(data);
          if (!activeId) setActiveId(data[0].id);
        }
      })
      .catch(console.error);
  }, []);

  const createConversation = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const conv: Conversation = await res.json();
      setConversations((prev) => [conv, ...prev]);
      setActiveId(conv.id);
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setActiveId((current) => (current === id ? null : current));
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  }, []);

  const updateTitle = useCallback((id: string, title: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    );
  }, []);

  return { conversations, activeId, setActiveId, createConversation, deleteConversation, refreshConversations, updateTitle };
}
