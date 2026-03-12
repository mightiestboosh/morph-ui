import { useState, useRef, useCallback } from 'react';
import { ArrowUp, Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  isListening?: boolean;
  interimTranscript?: string;
  onToggleVoice?: () => void;
  voiceSupported?: boolean;
}

export function ChatInput({
  onSend,
  disabled,
  isListening,
  interimTranscript,
  onToggleVoice,
  voiceSupported = true,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  const displayValue = isListening && interimTranscript ? interimTranscript : value;

  return (
    <div className="relative">
      <div className={cn(
        'flex items-end rounded-2xl border border-border/40 bg-white/40 backdrop-blur-xl shadow-sm',
        'focus-within:border-primary/40 focus-within:shadow-md',
        isListening && 'border-red-400 shadow-red-100',
        'transition-all duration-200'
      )}>
        <textarea
          ref={textareaRef}
          value={displayValue}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={disabled || isListening}
          placeholder={isListening ? 'Listening...' : 'Reply to Morph...'}
          rows={1}
          className={cn(
            'flex-1 resize-none bg-transparent px-4 py-3.5',
            'text-[15px] leading-relaxed placeholder:text-muted-foreground/60',
            'focus:outline-none',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            isListening && 'text-muted-foreground italic',
          )}
        />
        <div className="flex items-center gap-1 p-2">
          {voiceSupported && (
            <button
              onClick={onToggleVoice}
              disabled={disabled}
              className={cn(
                'p-2 rounded-xl transition-all duration-200',
                isListening
                  ? 'bg-red-500 text-white animate-pulse hover:bg-red-600'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
              aria-label={isListening ? 'Stop listening' : 'Start voice input'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={handleSend}
            disabled={disabled || !value.trim() || isListening}
            className={cn(
              'p-2 rounded-xl transition-all duration-200',
              value.trim() && !disabled && !isListening
                ? 'bg-primary text-primary-foreground hover:bg-primary-dark'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
            aria-label="Send message"
          >
            <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
      {isListening && (
        <div className="absolute -top-6 left-4 text-xs text-red-500 font-medium flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Listening — speak to chat or interact with the UI above
        </div>
      )}
    </div>
  );
}
