import { useState, useCallback } from 'react';
import { ChatView } from './components/chat/ChatView';
import { Sidebar } from './components/layout/Sidebar';
import { SettingsModal } from './components/layout/SettingsModal';
import { ApiKeyModal } from './components/layout/ApiKeyModal';
import { useConversations } from './hooks/useConversations';
import { useSettings } from './hooks/useSettings';

export default function App() {
  const { conversations, activeId, setActiveId, createConversation, deleteConversation, refreshConversations, updateTitle } = useConversations();
  const { settings, updateSettings } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleConversationUpdated = useCallback((conversationId?: string, title?: string) => {
    if (conversationId && title) {
      updateTitle(conversationId, title);
    } else {
      refreshConversations();
    }
  }, [updateTitle, refreshConversations]);

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile hamburger button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-3 left-3 z-40 p-2 rounded-lg bg-sidebar text-sidebar-foreground hover:bg-sidebar-muted transition-colors md:hidden"
        aria-label="Open menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-in-out
        md:relative md:translate-x-0 md:w-64 md:shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Mobile close button */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-muted transition-colors md:hidden"
          aria-label="Close menu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={(id) => { setActiveId(id); setSidebarOpen(false); }}
          onCreate={() => { createConversation(); setSidebarOpen(false); }}
          onDelete={deleteConversation}
          onOpenSettings={() => { setSettingsOpen(true); setSidebarOpen(false); }}
        />
      </div>

      <main className="flex-1 flex flex-col min-w-0">
        <ChatView
          conversationId={activeId}
          model={settings.model || 'claude-sonnet-4-6'}
          onConversationUpdated={handleConversationUpdated}
        />
      </main>
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdate={updateSettings}
      />
      <ApiKeyModal />
    </div>
  );
}
