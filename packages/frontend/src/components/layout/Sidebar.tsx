import { useState } from 'react';
import { Plus, Settings, Trash2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MorphLogo } from '@/components/MorphLogo';
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
    <aside className="w-full h-full flex flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <MorphLogo size={28} />
        <span className="text-xl font-bold tracking-tight text-sidebar-foreground">Morph</span>
      </div>
      <div className="p-3">
        <button
          onClick={onCreate}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2.5',
            'rounded-lg text-sm font-medium',
            'bg-sidebar-muted text-sidebar-foreground',
            'hover:bg-sidebar-muted/80 transition-colors'
          )}
        >
          <Plus className="w-4 h-4" />
          New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
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
          <p className="text-xs text-sidebar-muted-foreground text-center mt-8 px-4">
            No conversations yet
          </p>
        )}
      </div>

      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={onOpenSettings}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
            'text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-muted',
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
        'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer',
        'transition-colors text-sm',
        isActive
          ? 'bg-sidebar-muted text-sidebar-foreground'
          : 'text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-muted/50'
      )}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="flex-1 truncate">
        {conversation.title || 'Untitled'}
      </span>
      {hovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 rounded hover:bg-sidebar-muted text-sidebar-muted-foreground hover:text-destructive transition-colors"
          aria-label="Delete conversation"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
