import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { A2UISurface } from './A2UISurface';
import type { ChatMessage as ChatMessageType } from '@/hooks/useChat';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        )}
      >
        <div className="prose prose-sm max-w-none [&>p]:m-0 [&>p+p]:mt-2 [&>ul]:mt-1 [&>ol]:mt-1">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        {message.surfaces && message.surfaces.length > 0 && (
          <div className="mt-3 space-y-3">
            {message.surfaces.map((surface) => (
              <A2UISurface key={surface.surfaceId} surface={surface} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
