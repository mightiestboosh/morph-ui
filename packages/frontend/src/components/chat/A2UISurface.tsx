import React from 'react';
import type { UISurface } from '@/hooks/useChat';
import { DynamicRenderer } from '../a2ui/DynamicRenderer';
import type { FormHandle } from '../a2ui/DynamicRenderer';

interface A2UISurfaceProps {
  surface: UISurface;
  onAction?: (action: string, data: Record<string, unknown>) => void;
  formRef?: React.Ref<FormHandle>;
}

export function A2UISurface({ surface, onAction, formRef }: A2UISurfaceProps) {
  return (
    <div className="w-full">
      <DynamicRenderer
        node={surface.componentTree as import('../a2ui/DynamicRenderer').ComponentNode}
        onAction={(action, data) => {
          if (onAction) onAction(action, data ?? {});
        }}
        formRef={formRef}
      />
    </div>
  );
}
