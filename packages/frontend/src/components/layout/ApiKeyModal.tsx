import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { MorphLogo } from '@/components/MorphLogo';

export function ApiKeyModal() {
  const [show, setShow] = useState(false);
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/api-key/status')
      .then((r) => r.json())
      .then((data) => {
        if (!data.hasKey) setShow(true);
      })
      .catch(() => setShow(true));
  }, []);

  if (!show) return null;

  const handleSubmit = async () => {
    if (!key.trim()) {
      setError('Please enter your API key');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to set API key');
        return;
      }
      setShow(false);
    } catch {
      setError('Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-8 mx-4">
        <div className="flex flex-col items-center mb-6">
          <MorphLogo size={40} />
          <h2 className="text-xl font-semibold mt-3">Welcome to Morph</h2>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Enter your Anthropic API key to get started
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">
              API Key
            </label>
            <input
              type="password"
              value={key}
              onChange={(e) => { setKey(e.target.value); setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder="sk-ant-..."
              className={cn(
                'w-full rounded-xl border px-3 py-2.5 text-sm',
                'focus:outline-none focus:ring-2 focus:ring-primary/30',
                'placeholder:text-muted-foreground/60',
                error ? 'border-destructive' : 'border-input',
              )}
              autoFocus
            />
            {error && (
              <p className="text-xs text-destructive mt-1.5">{error}</p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Your key is stored in memory only and never persisted to disk.
            Get one at{' '}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              console.anthropic.com
            </a>
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className={cn(
            'w-full mt-6 px-4 py-2.5 rounded-xl text-sm font-medium',
            'bg-primary text-primary-foreground hover:bg-primary-dark',
            'transition-colors disabled:opacity-50',
          )}
        >
          {loading ? 'Connecting...' : 'Start using Morph'}
        </button>
      </div>
    </div>
  );
}
