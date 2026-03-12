import { useState, useEffect, useCallback } from 'react';

export interface Settings {
  model?: string;
  [key: string]: string | undefined;
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>({});

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data: Settings) => setSettings(data))
      .catch(console.error);
  }, []);

  const updateSettings = useCallback(async (updates: Partial<Settings>) => {
    const merged = { ...settings, ...updates };
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      });
      const data: Settings = await res.json();
      setSettings(data);
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  }, [settings]);

  return { settings, updateSettings };
}
