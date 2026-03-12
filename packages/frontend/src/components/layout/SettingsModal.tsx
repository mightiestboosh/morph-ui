import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Settings } from '@/hooks/useSettings';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onUpdate: (updates: Partial<Settings>) => Promise<void>;
}

const MODEL_OPTIONS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.0 (legacy)' },
];

export function SettingsModal({ open, onClose, settings, onUpdate }: SettingsModalProps) {
  const [model, setModel] = useState(settings.model || 'claude-sonnet-4-6');

  useEffect(() => {
    setModel(settings.model || 'claude-sonnet-4-6');
  }, [settings.model]);

  if (!open) return null;

  const handleSave = async () => {
    await onUpdate({ model });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-card rounded-2xl shadow-xl w-full max-w-md p-6 mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className={cn(
                'w-full rounded-xl border border-input bg-background px-3 py-2.5',
                'text-sm focus:outline-none focus:ring-2 focus:ring-ring/30',
                'transition-shadow'
              )}
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button
            onClick={onClose}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium',
              'border border-border hover:bg-muted transition-colors'
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium',
              'bg-primary text-primary-foreground hover:bg-primary-dark',
              'transition-colors'
            )}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
