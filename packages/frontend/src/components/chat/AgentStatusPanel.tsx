import { useState } from 'react';
import { CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp, Globe, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentStatus, AgentLogEntry } from '@/hooks/useChat';

interface AgentStatusPanelProps {
  statuses: AgentStatus[];
}

export function AgentStatusPanel({ statuses }: AgentStatusPanelProps) {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  // Filter out the parent dispatcher (no URL, just "Launching N browser agent(s)...")
  const visibleStatuses = statuses.filter((s) => s.url || (!s.message?.includes('browser agent(s)')));

  return (
    <div className="space-y-2">
      {visibleStatuses.map((agent) => {
        const isExpanded = expandedAgent === agent.label;
        return (
          <div key={agent.jobId} className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Clickable header */}
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
              onClick={() => setExpandedAgent(isExpanded ? null : agent.label)}
            >
              <StatusIcon status={agent.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate text-foreground">{agent.label}</p>
                  {agent.url && (
                    <span className="text-[11px] text-muted-foreground truncate max-w-[200px] hidden sm:inline">
                      {(() => { try { return new URL(agent.url).hostname; } catch { return ''; } })()}
                    </span>
                  )}
                </div>
                {agent.message && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {agent.message}
                  </p>
                )}
                {agent.status === 'running' && agent.progress != null && (
                  <div className="mt-2 h-1 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${Math.min(agent.progress, 100)}%` }}
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                {agent.logs.length > 0 && (
                  <span className="text-[11px] tabular-nums">{agent.logs.length}</span>
                )}
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </button>

            {/* Expanded detail view */}
            {isExpanded && (
              <div className="border-t border-border">
                <div className="flex flex-col lg:flex-row">
                  {/* Browser screenshot */}
                  <div className="lg:w-1/2 p-3 border-b lg:border-b-0 lg:border-r border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Browser</span>
                      {agent.url && (
                        <span className="text-[11px] text-muted-foreground truncate flex-1">
                          {agent.url}
                        </span>
                      )}
                    </div>
                    {agent.screenshot ? (
                      <div className="rounded-lg overflow-hidden border border-border bg-muted/20">
                        <img
                          src={agent.screenshot}
                          alt={`${agent.label} browser view`}
                          className="w-full h-auto"
                          style={{ maxHeight: 360, objectFit: 'contain', objectPosition: 'top' }}
                        />
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border bg-muted/10 flex items-center justify-center h-48 text-muted-foreground text-sm">
                        {agent.status === 'running' ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Waiting for screenshot...
                          </div>
                        ) : (
                          'No screenshot available'
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action log */}
                  <div className="lg:w-1/2 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Activity Log</span>
                    </div>
                    <div
                      className="rounded-lg border border-border bg-muted/10 overflow-y-auto font-mono text-xs"
                      style={{ maxHeight: 360, minHeight: 120 }}
                    >
                      {agent.logs.length > 0 ? (
                        <div className="divide-y divide-border/50">
                          {agent.logs.map((log, i) => (
                            <LogEntry key={i} entry={log} index={i} />
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-32 text-muted-foreground">
                          No activity yet
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LogEntry({ entry, index }: { entry: AgentLogEntry; index: number }) {
  const time = new Date(entry.timestamp);
  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="px-3 py-2 flex gap-3 hover:bg-muted/20">
      <span className="text-muted-foreground/60 tabular-nums shrink-0 select-none">{timeStr}</span>
      <div className="min-w-0">
        <span className="text-foreground/80 break-words">{entry.action}</span>
        {entry.detail && (
          <span className="text-muted-foreground ml-1.5">{entry.detail}</span>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: AgentStatus['status'] }) {
  switch (status) {
    case 'running':
      return <Loader2 className={cn('w-4 h-4 text-primary animate-spin shrink-0')} />;
    case 'complete':
      return <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-destructive shrink-0" />;
  }
}
