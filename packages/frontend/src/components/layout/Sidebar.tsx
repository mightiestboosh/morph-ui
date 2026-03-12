import { useState } from 'react';
import { Plus, Settings, Trash2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Conversation } from '@/hooks/useConversations';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
}

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  onOpenSettings,
}: SidebarProps) {
  return (
    <aside className="w-[280px] border-r border-border flex flex-col bg-muted/30">
      <div className="p-3">
        <button
          onClick={onCreate}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-2.5',
            'rounded-lg bg-primary text-primary-foreground text-sm font-medium',
            'hover:bg-primary-dark transition-colors'
          )}
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {conversations.map((conv) => (
          <ConversationItem
            key={conv.id}
            conversation={conv}
            isActive={conv.id === activeId}
            onSelect={() => onSelect(conv.id)}
            onDelete={() => onDelete(conv.id)}
          />
        ))}
        {conversations.length === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-8 px-4">
            No conversations yet
          </p>
        )}
      </div>

      <div className="border-t border-border p-3">
        <button
          onClick={onOpenSettings}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
            'text-muted-foreground hover:text-foreground hover:bg-muted',
            'transition-colors'
          )}
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>
    </aside>
  );
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
}: {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer mb-0.5',
        'transition-colors',
        isActive ? 'bg-muted' : 'hover:bg-muted/60'
      )}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="flex-1 text-sm truncate">
        {conversation.title || 'Untitled'}
      </span>
      {hovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Delete conversation"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
