'use client';
import { useCallback, useEffect, useState } from 'react';
import { Download, Trash2, ShieldCheck, CheckCircle2, XCircle, Loader2, Filter } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Panel } from '@/components/Panel';
import { Button } from '@/components/Button';
import { apiFetch, apiJson } from '@/lib/ui/fetcher';
import { formatAbsolute, formatBytes, formatRelative } from '@/lib/ui/format';

interface BackupRun {
  id: string;
  targetId: string;
  targetLabel: string;
  dbName: string;
  fileName: string;
  sizeBytes: number;
  startedAt: string;
  finishedAt: string | null;
  status: 'success' | 'error' | 'running';
  errorMessage?: string;
  protected: boolean;
}

interface Target { id: string; label: string; dbName: string; }

export default function HistoryPage() {
  const [backups, setBackups] = useState<BackupRun[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [b, t] = await Promise.all([
        apiJson<{ backups: BackupRun[] }>(`/api/backups${filter ? `?dbName=${encodeURIComponent(filter)}` : ''}`),
        apiJson<{ targets: Target[] }>('/api/targets'),
      ]);
      setBackups(b.backups);
      setTargets(t.targets);
    } catch (err: any) {
      setError(err.message);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function remove(b: BackupRun) {
    if (b.protected) return;
    if (!confirm(`Delete backup ${b.fileName}?\n\nThe file will be removed from the USB stick.`)) return;
    const res = await apiFetch(`/api/backups/${b.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(`Delete failed: ${j.error ?? res.status}`);
    }
    load();
  }

  const dbNames = Array.from(new Set(targets.map((t) => t.dbName))).sort();

  return (
    <AppShell>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">History</h1>
          <p className="mt-0.5 font-mono text-xs text-fg-muted">All backup runs, most recent first.</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-fg-muted" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 rounded-md border border-bg-border bg-bg-raised px-2 font-mono text-xs"
          >
            <option value="">All databases</option>
            {dbNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 font-mono text-xs text-accent-red">
          {error}
        </div>
      )}

      {backups.length === 0 ? (
        <Panel>
          <p className="py-6 text-center text-fg-muted">No backup runs yet.</p>
        </Panel>
      ) : (
        <Panel dense>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bg-border font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted">
                  <th className="px-2 py-2 text-left">Status</th>
                  <th className="px-2 py-2 text-left">Target</th>
                  <th className="px-2 py-2 text-left">Started</th>
                  <th className="px-2 py-2 text-left">Size</th>
                  <th className="px-2 py-2 text-left">Flags</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.id} className="border-b border-bg-border/70 last:border-b-0">
                    <td className="px-2 py-3">
                      <StatusPill status={b.status} />
                    </td>
                    <td className="px-2 py-3">
                      <div className="font-medium">{b.targetLabel}</div>
                      <div className="font-mono text-[11px] text-fg-muted">{b.dbName}</div>
                    </td>
                    <td className="px-2 py-3">
                      <div className="font-mono text-xs">{formatAbsolute(b.startedAt)}</div>
                      <div className="font-mono text-[10px] text-fg-faint">{formatRelative(b.startedAt)}</div>
                    </td>
                    <td className="px-2 py-3 font-mono text-xs">{formatBytes(b.sizeBytes)}</td>
                    <td className="px-2 py-3">
                      {b.protected && (
                        <span className="inline-flex items-center gap-1 rounded border border-accent-cyan/40 bg-accent-cyan/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-accent-cyan">
                          <ShieldCheck className="h-3 w-3" /> monthly
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex justify-end gap-1">
                        {b.status === 'success' && (
                          <a href={`/api/backups/${b.id}/download`} download>
                            <Button size="sm" variant="ghost" title="Download"><Download className="h-3 w-3" /></Button>
                          </a>
                        )}
                        <Button size="sm" variant="danger" disabled={b.protected || b.status === 'running'} onClick={() => remove(b)} title={b.protected ? 'Protected' : 'Delete'}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      {b.errorMessage && (
                        <div className="mt-1 max-w-xs truncate text-right font-mono text-[10px] text-accent-red" title={b.errorMessage}>
                          {b.errorMessage}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </AppShell>
  );
}

function StatusPill({ status }: { status: 'success' | 'error' | 'running' }) {
  if (status === 'success') return <span className="inline-flex items-center gap-1 font-mono text-xs text-accent-green"><CheckCircle2 className="h-3.5 w-3.5" /> ok</span>;
  if (status === 'error') return <span className="inline-flex items-center gap-1 font-mono text-xs text-accent-red"><XCircle className="h-3.5 w-3.5" /> failed</span>;
  return <span className="inline-flex items-center gap-1 font-mono text-xs text-accent-amber"><Loader2 className="h-3.5 w-3.5 animate-spin" /> running</span>;
}
