'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Upload, Clock, Mail, Server, HardDrive, ShieldCheck, RefreshCcw, CheckCircle2, XCircle } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Panel } from '@/components/Panel';
import { Button } from '@/components/Button';
import { apiFetch, apiJson } from '@/lib/ui/fetcher';
import { formatBytes } from '@/lib/ui/format';
import { cn } from '@/lib/ui/cn';

interface StatusResp {
  storage: { source: 'setting' | 'env'; dir: string; usable: boolean; reason: string | null };
  config: {
    cron: string;
    retentionDays: number;
    tz: string;
    smtpEnabled: boolean;
    mongoConfigured: boolean;
    backupDir: string;
  };
}

interface MountEntry {
  name: string;
  path: string;
  isMountPoint: boolean;
  writable: boolean;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usedPercent: number;
}

export default function SettingsPage() {
  const [cfg, setCfg] = useState<StatusResp | null>(null);
  const [mounts, setMounts] = useState<MountEntry[] | null>(null);
  const [mountsRoot, setMountsRoot] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [s, m] = await Promise.all([
        apiJson<StatusResp>('/api/status'),
        apiJson<{ mounts: MountEntry[]; root: string }>('/api/mounts'),
      ]);
      setCfg(s);
      setMounts(m.mounts);
      setMountsRoot(m.root);
      setErr(null);
    } catch (e: any) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function pickBackupDir(pathOrNull: string | null) {
    setSaving(true);
    setMsg(null);
    try {
      const res = await apiFetch('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({ backupDir: pathOrNull }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setMsg(pathOrNull ? 'Backup destination updated.' : 'Backup destination cleared.');
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setErr('File too large (5 MB max)'); return; }
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await apiFetch('/api/config/import', { method: 'POST', body: JSON.stringify({ payload, mode: importMode }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setMsg(`Imported ${j.targets} targets and ${j.backups} backup entries.`);
      setErr(null);
    } catch (e: any) { setErr(e.message); setMsg(null); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  }

  const selectedDir = cfg?.storage.source === 'setting' ? cfg.storage.dir : null;

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-0.5 font-mono text-xs text-fg-muted">Storage, runtime config, and backup import/export.</p>
      </header>

      <div className="mb-4">
        <Panel
          title="Backup storage"
          right={
            <Button size="sm" variant="ghost" onClick={load}>
              <RefreshCcw className="h-3 w-3" /> Rescan
            </Button>
          }
        >
          {cfg && !cfg.storage.usable && (
            <div className="mb-3 rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 font-mono text-xs text-accent-red">
              No usable backup destination — pick one below before running any backup.
              {cfg.storage.reason && <> <span className="text-fg-muted">({cfg.storage.reason})</span></>}
            </div>
          )}
          <p className="mb-3 text-sm text-fg-muted">
            Watchy scans <code className="font-mono text-fg">{mountsRoot || '…'}</code> for candidate destinations
            (bind-mounted from the host&apos;s <code className="font-mono text-fg">/mnt</code>). Pick where dumps should be written.
          </p>

          {mounts === null ? (
            <div className="py-4 text-fg-muted text-sm">Loading…</div>
          ) : mounts.length === 0 ? (
            <div className="rounded-md border border-bg-border bg-bg-raised/40 p-4 text-sm text-fg-muted">
              No mounts detected under <code className="font-mono">{mountsRoot}</code>.
              Mount your disk on the host (see README) and click <em>Rescan</em>.
            </div>
          ) : (
            <ul className="space-y-2">
              {mounts.map((m) => {
                const isSelected = selectedDir === m.path;
                const zone = m.usedPercent >= 90 ? 'crit' : m.usedPercent >= 70 ? 'warn' : 'ok';
                const disabled = !m.writable;
                return (
                  <li key={m.path}>
                    <button
                      type="button"
                      onClick={() => !disabled && pickBackupDir(m.path)}
                      disabled={disabled || saving}
                      className={cn(
                        'w-full rounded-md border p-3 text-left transition-colors',
                        isSelected
                          ? 'border-accent-cyan bg-accent-cyan/10'
                          : 'border-bg-border bg-bg-raised/40 hover:border-fg-muted',
                        disabled && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <HardDrive className={cn('h-4 w-4', isSelected ? 'text-accent-cyan' : 'text-fg-muted')} />
                            <span className="font-medium">{m.name}</span>
                            {m.isMountPoint ? (
                              <span className="rounded border border-accent-green/40 bg-accent-green/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-accent-green">mount</span>
                            ) : (
                              <span className="rounded border border-fg-muted/30 bg-fg-muted/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-fg-muted">dir</span>
                            )}
                            {!m.writable && (
                              <span className="rounded border border-accent-red/40 bg-accent-red/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-accent-red">read-only</span>
                            )}
                            {isSelected && <CheckCircle2 className="h-4 w-4 text-accent-cyan" />}
                          </div>
                          <div className="mt-1 truncate font-mono text-xs text-fg-muted">{m.path}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className={cn(
                            'font-mono text-xs',
                            zone === 'crit' && 'text-accent-red',
                            zone === 'warn' && 'text-accent-amber',
                            zone === 'ok' && 'text-fg'
                          )}>
                            {formatBytes(m.freeBytes)} free
                          </div>
                          <div className="font-mono text-[10px] text-fg-faint">of {formatBytes(m.totalBytes)}</div>
                        </div>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-bg-border">
                        <div
                          className={cn(
                            'h-full',
                            zone === 'crit' ? 'bg-accent-red' : zone === 'warn' ? 'bg-accent-amber' : 'bg-accent-green'
                          )}
                          style={{ width: `${Math.min(100, m.usedPercent).toFixed(1)}%` }}
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {selectedDir && (
            <div className="mt-3 flex items-center justify-between text-xs text-fg-muted">
              <span>Currently writing to <code className="font-mono text-fg">{selectedDir}</code></span>
              <button className="font-mono text-accent-red hover:underline" onClick={() => pickBackupDir(null)}>
                clear selection
              </button>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Runtime configuration">
          <dl className="space-y-2.5 text-sm">
            <Row icon={<Clock className="h-4 w-4" />} label="Cron"><code className="font-mono">{cfg?.config.cron ?? '—'}</code></Row>
            <Row icon={<Clock className="h-4 w-4" />} label="Timezone"><code className="font-mono">{cfg?.config.tz ?? '—'}</code></Row>
            <Row icon={<ShieldCheck className="h-4 w-4" />} label="Retention"><code className="font-mono">{cfg?.config.retentionDays ?? '—'} days</code></Row>
            <Row icon={<HardDrive className="h-4 w-4" />} label="Effective backup dir"><code className="font-mono text-xs break-all">{cfg?.storage.dir ?? '—'}</code></Row>
            <Row icon={<Server className="h-4 w-4" />} label="Mongo default connection">
              <span className={cfg?.config.mongoConfigured ? 'text-accent-green' : 'text-accent-amber'}>
                {cfg?.config.mongoConfigured ? 'configured' : 'not configured'}
              </span>
            </Row>
            <Row icon={<Mail className="h-4 w-4" />} label="SMTP notifications">
              <span className={cfg?.config.smtpEnabled ? 'text-accent-green' : 'text-fg-muted'}>
                {cfg?.config.smtpEnabled ? 'enabled' : 'disabled'}
              </span>
            </Row>
          </dl>
          <p className="mt-4 font-mono text-[10px] text-fg-faint">
            These values come from environment variables — edit the container&apos;s .env and restart to change them.
          </p>
        </Panel>

        <Panel title="Backup config transfer">
          <p className="mb-3 text-sm text-fg-muted">
            Export your targets, settings and backup index as a JSON file (does not include dump contents), or import a previous export.
          </p>
          <div className="flex flex-col gap-2">
            <a href="/api/config/export" download>
              <Button variant="ghost" className="w-full"><Download className="h-3.5 w-3.5" /> Export config</Button>
            </a>
            <div className="rounded-md border border-bg-border bg-bg-raised/40 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs">
                <span className="text-fg-muted">Import mode:</span>
                <label className="flex items-center gap-1"><input type="radio" checked={importMode === 'merge'} onChange={() => setImportMode('merge')} /> merge</label>
                <label className="flex items-center gap-1"><input type="radio" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} /> replace</label>
              </div>
              <input ref={fileRef} type="file" accept="application/json,.json" onChange={onImportFile} className="hidden" id="importfile" />
              <label htmlFor="importfile">
                <span className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-bg-border bg-bg-raised px-3 text-sm hover:border-fg-muted">
                  <Upload className="h-3.5 w-3.5" /> Choose JSON file…
                </span>
              </label>
            </div>
          </div>
        </Panel>
      </div>

      {msg && <div className="mt-4 rounded border border-accent-green/40 bg-accent-green/10 px-3 py-2 font-mono text-xs text-accent-green">{msg}</div>}
      {err && <div className="mt-4 rounded border border-accent-red/40 bg-accent-red/10 px-3 py-2 font-mono text-xs text-accent-red">{err}</div>}
    </AppShell>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-fg-muted"><span className="text-fg-faint">{icon}</span>{label}</span>
      <span>{children}</span>
    </div>
  );
}
