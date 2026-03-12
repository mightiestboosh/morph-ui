import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChevronRight, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { A2UISurface } from './A2UISurface';
import type { ChatMessage as ChatMessageType } from '@/hooks/useChat';
import type { FormHandle } from '../a2ui/DynamicRenderer';

interface ChatMessageProps {
  message: ChatMessageType;
  onAction?: (action: string, data: Record<string, unknown>) => void;
  onEdit?: (messageId: string) => void;
  formRef?: React.Ref<FormHandle>;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === 'string') {
    // Check if it's an ISO date
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      try {
        return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } catch { /* not a date */ }
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(formatValue).join(', ');
  return String(value);
}

function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function SubmittedSummary({ data, onEdit }: { data: Record<string, unknown>; onEdit?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const entries = Object.entries(data).filter(
    ([key, val]) => key !== 'id' && val !== undefined && val !== null && val !== ''
  );

  if (entries.length === 0) return null;

  // Build a one-line summary: "Location: New York, NY · Distance: 1 mile · Sort By: Rating · +5 more"
  const MAX_INLINE = 3;
  const inlineEntries = entries.slice(0, MAX_INLINE);
  const remaining = entries.length - MAX_INLINE;
  const inlineSummary = inlineEntries
    .map(([key, val]) => `${formatLabel(key)}: ${formatValue(val)}`)
    .join(' · ');

  return (
    <div className="border border-border rounded-xl bg-muted/30 overflow-hidden a2ui-collapse-enter">
      {/* Collapsed: single line, clickable */}
      <button
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronRight
          className={cn(
            'w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200',
            expanded && 'rotate-90',
          )}
        />
        <span className="text-sm text-foreground truncate">
          {inlineSummary}
        </span>
        {remaining > 0 && (
          <span className="text-xs text-muted-foreground shrink-0">+{remaining} more</span>
        )}
      </button>

      {/* Expanded: full grid + edit button */}
      {expanded && (
        <div className="border-t border-border px-5 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
            {entries.map(([key, val]) => (
              <div key={key} className="min-w-0">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
                  {formatLabel(key)}
                </div>
                <div className="text-sm font-medium text-foreground truncate">
                  {formatValue(val)}
                </div>
              </div>
            ))}
          </div>
          {onEdit && (
            <div className="mt-4 pt-3 border-t border-border/50 flex justify-end">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="inline-flex items-center gap-2.5 rounded-xl px-7 py-3 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary-dark transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm hover:shadow-md"
              >
                Edit selections
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ChatMessage({ message, onAction, onEdit, formRef }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const hasSurfaces = message.surfaces && message.surfaces.length > 0;
  const hasContent = message.content && message.content.trim().length > 0;
  const isSubmitted = !!message.submittedData;

  // Hide action messages entirely
  if (isUser && message.isAction) {
    return null;
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] px-4 py-2.5 rounded-3xl bg-user-bubble text-user-bubble-foreground text-[15px] leading-relaxed">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      </div>
    );
  }

  // Assistant message with submitted surface → show collapsed summary (no text)
  if (hasSurfaces && isSubmitted) {
    return (
      <div className="w-full space-y-4">
        <SubmittedSummary
          data={message.submittedData!}
          onEdit={onEdit ? () => onEdit(message.id) : undefined}
        />
      </div>
    );
  }

  // Assistant messages: full width, no bubble
  // Hide text when UI surfaces are present — the UI speaks for itself
  return (
    <div className="w-full space-y-4">
      {hasSurfaces && (
        <div className="space-y-4">
          {message.surfaces!.map((surface) => (
            <A2UISurface key={surface.surfaceId} surface={surface} onAction={onAction} formRef={formRef} />
          ))}
        </div>
      )}

      {hasContent && !hasSurfaces && (
        <div className="text-[15px] leading-[1.7] text-foreground">
          <div className={cn(
            'prose prose-neutral max-w-none',
            'prose-p:my-1.5 prose-p:leading-[1.7]',
            'prose-headings:font-semibold prose-headings:text-foreground',
            'prose-h1:text-xl prose-h2:text-lg prose-h3:text-base',
            'prose-strong:font-semibold prose-strong:text-foreground',
            'prose-code:text-sm prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none',
            'prose-pre:bg-[#2A2520] prose-pre:text-[#E8E4DD] prose-pre:rounded-xl prose-pre:p-4',
            'prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5',
            'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
            'prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground',
          )}>
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
