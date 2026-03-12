import type { UISurface } from '@/hooks/useChat';
import { DynamicRenderer } from '../a2ui/DynamicRenderer';

interface A2UISurfaceProps {
  surface: UISurface;
}

export function A2UISurface({ surface }: A2UISurfaceProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <DynamicRenderer node={surface.componentTree as import('../a2ui/DynamicRenderer').ComponentNode} onAction={(action, data) => console.log('[A2UI Action]', action, data)} />
    </div>
  );
}
