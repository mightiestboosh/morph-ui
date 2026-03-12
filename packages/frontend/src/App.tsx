import { useState } from 'react';
import { ChatView } from './components/chat/ChatView';
import { Sidebar } from './components/layout/Sidebar';
import { SettingsModal } from './components/layout/SettingsModal';
import { useConversations } from './hooks/useConversations';
import { useSettings } from './hooks/useSettings';

export default function App() {
  const { conversations, activeId, setActiveId, createConversation, deleteConversation } = useConversations();
  const { settings, updateSettings } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onCreate={createConversation}
        onDelete={deleteConversation}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <main className="flex-1 flex flex-col">
        <ChatView
          conversationId={activeId}
          model={settings.model || 'claude-sonnet-4-20250514'}
        />
      </main>
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdate={updateSettings}
      />
    </div>
  );
}
