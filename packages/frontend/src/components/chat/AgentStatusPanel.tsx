import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentStatus } from '@/hooks/useChat';

interface AgentStatusPanelProps {
  statuses: AgentStatus[];
}

export function AgentStatusPanel({ statuses }: AgentStatusPanelProps) {
  return (
    <div className="space-y-2">
      {statuses.map((agent) => (
        <div
          key={agent.jobId}
          className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
        >
          <StatusIcon status={agent.status} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{agent.label}</p>
            {agent.message && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {agent.message}
              </p>
            )}
            {agent.status === 'running' && agent.progress != null && (
              <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.min(agent.progress, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusIcon({ status }: { status: AgentStatus['status'] }) {
  switch (status) {
    case 'running':
      return <Loader2 className={cn('w-5 h-5 text-primary animate-spin')} />;
    case 'complete':
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    case 'failed':
      return <XCircle className="w-5 h-5 text-destructive" />;
  }
}
