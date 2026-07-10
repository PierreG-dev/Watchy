'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Play, Database, Clock, HardDrive, Server, Mail, PlusCircle, RefreshCcw } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Panel } from '@/components/Panel';
import { Button } from '@/components/Button';
import { LED } from '@/components/LED';
import { DiskGauge } from '@/components/DiskGauge';
import { apiFetch, apiJson } from '@/lib/ui/fetcher';
import { formatBytes, formatRelative } from '@/lib/ui/format';

type StatusResp = {
  cards: {
    target: { id: string; label: string; dbName: string; customUri?: string };
    isRunning: boolean;
    lastStatus: 'success' | 'error' | 'running' | null;
    lastAt: string | null;
    lastError: string | null;
    lastSuccessAt: string | null;
    lastSuccessSize: number | null;
    totalRuns: number;
  }[];
  disk: { path: string; totalBytes: number; freeBytes: number; usedBytes: number; usedPercent: number } | null;
  config: {
    cron: string;
    retentionDays: number;
    tz: string;
    smtpEnabled: boolean;
    mongoConfigured: boolean;
    backupDir: string;
  };
};

export default function Dashboard() {
  const [data, setData] = useState<StatusResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [runningAll, setRunningAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await apiJson<StatusResp>('/api/status');
      setData(d);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function runOne(id: string) {
    setBusy((s) => ({ ...s, [id]: true }));
    try {
      const res = await apiFetch(`/api/targets/${id}/backup`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(`Backup failed: ${j.error ?? res.status}`);
      }
      await load();
    } finally {
      setBusy((s) => ({ ...s, [id]: false }));
    }
  }

  async function runAll() {
    if (!confirm('Trigger a backup of every target now?')) return;
    setRunningAll(true);
    try {
      const res = await apiFetch('/api/backups/run', { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) alert(`Run failed: ${j.error ?? res.status}`);
      else alert(`Done: ${j.success}/${j.total} succeeded, ${j.failed} failed`);
      await load();
    } finally {
      setRunningAll(false);
    }
  }

  return (
    <AppShell>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="mt-0.5 font-mono text-xs text-fg-muted">Overview of scheduled MongoDB backups.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={load} variant="ghost" size="sm">
            <RefreshCcw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button onClick={runAll} variant="primary" size="sm" loading={runningAll}>
            <Play className="h-3.5 w-3.5" /> Back up all
          </Button>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 font-mono text-xs text-accent-red">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Panel title="Backup disk" className="md:col-span-1">
          {data?.disk ? (
            <DiskGauge {...data.disk} />
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 text-fg-muted">
              <HardDrive className="h-6 w-6" />
              <p className="font-mono text-xs">Disk info unavailable</p>
            </div>
          )}
        </Panel>

        <Panel title="System" className="md:col-span-2">
          <ul className="space-y-3 text-sm">
            <SystemRow
              icon={<Server className="h-4 w-4 text-fg-muted" />}
              label="MongoDB default connection"
              value={data?.config.mongoConfigured ? 'Configured' : 'Not configured'}
              tone={data?.config.mongoConfigured ? 'green' : 'amber'}
            />
            <SystemRow
              icon={<Mail className="h-4 w-4 text-fg-muted" />}
              label="Email notifications (SMTP)"
              value={data?.config.smtpEnabled ? 'Enabled' : 'Disabled (no email will be sent)'}
              tone={data?.config.smtpEnabled ? 'green' : 'off'}
            />
            <SystemRow
              icon={<Clock className="h-4 w-4 text-fg-muted" />}
              label="Schedule"
              value={`${data?.config.cron ?? '—'}  ·  TZ ${data?.config.tz ?? '—'}`}
              mono
            />
            <SystemRow
              icon={<HardDrive className="h-4 w-4 text-fg-muted" />}
              label="Retention"
              value={`${data?.config.retentionDays ?? '—'} days · monthly kept forever`}
            />
          </ul>
        </Panel>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-fg-muted">Targets</h2>
          <Link href="/targets" className="inline-flex items-center gap-1.5 font-mono text-xs text-accent-cyan hover:underline">
            <PlusCircle className="h-3.5 w-3.5" /> manage
          </Link>
        </div>

        {data?.cards.length === 0 ? (
          <Panel>
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Database className="h-8 w-8 text-fg-faint" />
              <div>
                <p className="font-medium">No backup targets yet</p>
                <p className="mt-1 text-sm text-fg-muted">Create your first target to start protecting a database.</p>
              </div>
              <Link href="/targets">
                <Button variant="primary" size="sm"><PlusCircle className="h-3.5 w-3.5" /> Add a target</Button>
              </Link>
            </div>
          </Panel>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data?.cards.map((c) => {
              const tone: 'green' | 'red' | 'amber' | 'cyan' | 'off' =
                c.isRunning ? 'cyan' : c.lastStatus === 'success' ? 'green' : c.lastStatus === 'error' ? 'red' : 'off';
              const label = c.isRunning ? 'BACKING UP' : c.lastStatus === 'success' ? 'OK' : c.lastStatus === 'error' ? 'FAILED' : 'NO RUNS';
              return (
                <Panel key={c.target.id} dense>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{c.target.label}</div>
                      <div className="mt-0.5 truncate font-mono text-xs text-fg-muted">{c.target.dbName}</div>
                    </div>
                    <LED tone={tone} pulse={c.isRunning} label={label} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px] text-fg-muted">
                    <div>
                      <div className="text-fg-faint">Last</div>
                      <div className="text-fg">{formatRelative(c.lastAt)}</div>
                    </div>
                    <div>
                      <div className="text-fg-faint">Size</div>
                      <div className="text-fg">{formatBytes(c.lastSuccessSize)}</div>
                    </div>
                  </div>
                  {c.lastError && (
                    <div className="mt-2 line-clamp-2 rounded border border-accent-red/30 bg-accent-red/5 px-2 py-1 font-mono text-[10px] text-accent-red">
                      {c.lastError}
                    </div>
                  )}
                  <div className="mt-3 flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => runOne(c.target.id)} loading={busy[c.target.id] || c.isRunning}>
                      <Play className="h-3 w-3" /> Back up now
                    </Button>
                  </div>
                </Panel>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function SystemRow({ icon, label, value, tone, mono }: { icon: React.ReactNode; label: string; value: string; tone?: 'green' | 'amber' | 'red' | 'off'; mono?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-fg-muted">{icon}<span className="text-sm">{label}</span></span>
      <span className="flex items-center gap-2">
        {tone && <LED tone={tone} />}
        <span className={mono ? 'font-mono text-xs text-fg' : 'text-sm text-fg'}>{value}</span>
      </span>
    </li>
  );
}
