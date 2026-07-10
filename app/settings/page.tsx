'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Upload, Clock, Mail, Server, HardDrive, ShieldCheck } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Panel } from '@/components/Panel';
import { Button } from '@/components/Button';
import { apiFetch, apiJson } from '@/lib/ui/fetcher';

interface StatusResp {
  config: {
    cron: string;
    retentionDays: number;
    tz: string;
    smtpEnabled: boolean;
    mongoConfigured: boolean;
    backupDir: string;
  };
}

export default function SettingsPage() {
  const [cfg, setCfg] = useState<StatusResp['config'] | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const d = await apiJson<StatusResp>('/api/status').catch((e) => { setErr(e.message); return null; });
    if (d) setCfg(d.config);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErr('File too large (5 MB max)');
      return;
    }
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await apiFetch('/api/config/import', {
        method: 'POST',
        body: JSON.stringify({ payload, mode: importMode }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setMsg(`Imported ${j.targets} targets and ${j.backups} backup entries.`);
      setErr(null);
    } catch (e: any) {
      setErr(e.message);
      setMsg(null);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-0.5 font-mono text-xs text-fg-muted">Read-only overview of the current configuration, plus config export/import.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Runtime configuration">
          <dl className="space-y-2.5 text-sm">
            <Row icon={<Clock className="h-4 w-4" />} label="Cron">
              <code className="font-mono">{cfg?.cron ?? '—'}</code>
            </Row>
            <Row icon={<Clock className="h-4 w-4" />} label="Timezone">
              <code className="font-mono">{cfg?.tz ?? '—'}</code>
            </Row>
            <Row icon={<ShieldCheck className="h-4 w-4" />} label="Retention">
              <code className="font-mono">{cfg?.retentionDays ?? '—'} days</code>
            </Row>
            <Row icon={<HardDrive className="h-4 w-4" />} label="Backup dir">
              <code className="font-mono text-xs break-all">{cfg?.backupDir ?? '—'}</code>
            </Row>
            <Row icon={<Server className="h-4 w-4" />} label="Mongo default connection">
              <span className={cfg?.mongoConfigured ? 'text-accent-green' : 'text-accent-amber'}>
                {cfg?.mongoConfigured ? 'configured' : 'not configured'}
              </span>
            </Row>
            <Row icon={<Mail className="h-4 w-4" />} label="SMTP notifications">
              <span className={cfg?.smtpEnabled ? 'text-accent-green' : 'text-fg-muted'}>
                {cfg?.smtpEnabled ? 'enabled' : 'disabled'}
              </span>
            </Row>
          </dl>
          <p className="mt-4 font-mono text-[10px] text-fg-faint">
            These values come from environment variables — edit the container&apos;s .env and restart to change them.
          </p>
        </Panel>

        <Panel title="Backup config transfer">
          <p className="mb-3 text-sm text-fg-muted">
            Export your targets and backup index as a JSON file (does not include dump contents), or import a previous export.
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
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                onChange={onImportFile}
                className="hidden"
                id="importfile"
              />
              <label htmlFor="importfile">
                <span className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-bg-border bg-bg-raised px-3 text-sm hover:border-fg-muted">
                  <Upload className="h-3.5 w-3.5" /> Choose JSON file…
                </span>
              </label>
            </div>
          </div>
          {msg && <div className="mt-3 rounded border border-accent-green/40 bg-accent-green/10 px-3 py-2 font-mono text-xs text-accent-green">{msg}</div>}
          {err && <div className="mt-3 rounded border border-accent-red/40 bg-accent-red/10 px-3 py-2 font-mono text-xs text-accent-red">{err}</div>}
        </Panel>
      </div>
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
