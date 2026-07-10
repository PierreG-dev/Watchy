'use client';
import { useCallback, useEffect, useState } from 'react';
import { PlusCircle, Trash2, Pencil, PlugZap, Play, Database } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Panel } from '@/components/Panel';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { Input, Label, Textarea } from '@/components/Input';
import { apiFetch, apiJson } from '@/lib/ui/fetcher';

interface Target {
  id: string;
  label: string;
  dbName: string;
  customUri?: string;
  createdAt: string;
  updatedAt: string;
}

export default function TargetsPage() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [editing, setEditing] = useState<Target | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, string | null>>({});

  const load = useCallback(async () => {
    try {
      const d = await apiJson<{ targets: Target[] }>('/api/targets');
      setTargets(d.targets);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function testTarget(id: string) {
    setBusy((s) => ({ ...s, [id]: 'testing' }));
    try {
      const res = await apiFetch(`/api/targets/${id}/test`, { method: 'POST' });
      const j = await res.json();
      if (j.ok) alert('Connection OK');
      else alert(`Connection failed:\n${j.error}`);
    } finally {
      setBusy((s) => ({ ...s, [id]: null }));
    }
  }

  async function runTarget(id: string) {
    setBusy((s) => ({ ...s, [id]: 'running' }));
    try {
      const res = await apiFetch(`/api/targets/${id}/backup`, { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) alert(`Backup failed: ${j.error ?? res.status}`);
      else alert('Backup completed');
    } finally {
      setBusy((s) => ({ ...s, [id]: null }));
    }
  }

  async function removeTarget(t: Target) {
    if (!confirm(`Delete target "${t.label}"?\n\nThis does NOT delete existing dump files.`)) return;
    await apiFetch(`/api/targets/${t.id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <AppShell>
      <header className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Targets</h1>
          <p className="mt-0.5 font-mono text-xs text-fg-muted">Databases to back up. All targets use the default connection unless a custom URI is set.</p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <PlusCircle className="h-3.5 w-3.5" /> New target
        </Button>
      </header>

      {error && (
        <div className="mb-4 rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 font-mono text-xs text-accent-red">
          {error}
        </div>
      )}

      {targets.length === 0 ? (
        <Panel>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Database className="h-8 w-8 text-fg-faint" />
            <div>
              <p className="font-medium">No targets configured</p>
              <p className="mt-1 text-sm text-fg-muted">Add one to start backing up.</p>
            </div>
          </div>
        </Panel>
      ) : (
        <Panel dense>
          <div className="divide-y divide-bg-border">
            {targets.map((t) => (
              <div key={t.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="font-medium">{t.label}</div>
                  <div className="mt-0.5 font-mono text-xs text-fg-muted">
                    db: <span className="text-fg">{t.dbName}</span>
                    {t.customUri && <span className="ml-2 rounded bg-bg-raised px-1.5 py-0.5 text-[10px] text-accent-amber">CUSTOM URI</span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" onClick={() => testTarget(t.id)} loading={busy[t.id] === 'testing'}>
                    <PlugZap className="h-3 w-3" /> Test
                  </Button>
                  <Button size="sm" onClick={() => runTarget(t.id)} loading={busy[t.id] === 'running'}>
                    <Play className="h-3 w-3" /> Backup
                  </Button>
                  <Button size="sm" onClick={() => setEditing(t)}>
                    <Pencil className="h-3 w-3" /> Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => removeTarget(t)}>
                    <Trash2 className="h-3 w-3" /> Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <TargetFormModal
        open={creating || editing !== null}
        target={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={async () => { setCreating(false); setEditing(null); await load(); }}
      />
    </AppShell>
  );
}

function TargetFormModal({ open, target, onClose, onSaved }: { open: boolean; target: Target | null; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState('');
  const [dbName, setDbName] = useState('');
  const [customUri, setCustomUri] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLabel(target?.label ?? '');
      setDbName(target?.dbName ?? '');
      setCustomUri(target?.customUri ?? '');
      setErr(null);
    }
  }, [open, target]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const body = { label, dbName, customUri: customUri || undefined };
      const url = target ? `/api/targets/${target.id}` : '/api/targets';
      const method = target ? 'PATCH' : 'POST';
      const res = await apiFetch(url, { method, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={target ? 'Edit target' : 'New target'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit as any} loading={saving}>{target ? 'Save' : 'Create'}</Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label htmlFor="label">Label</Label>
          <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Users prod" required />
        </div>
        <div>
          <Label htmlFor="dbName">Database name</Label>
          <Input id="dbName" mono value={dbName} onChange={(e) => setDbName(e.target.value)} placeholder="users" required />
        </div>
        <div>
          <Label htmlFor="customUri">Custom URI (optional)</Label>
          <Textarea
            id="customUri"
            value={customUri}
            onChange={(e) => setCustomUri(e.target.value)}
            placeholder="mongodb://user:pass@host:27017/db?authSource=admin"
          />
          <p className="mt-1 font-mono text-[10px] text-fg-faint">Only fill this in to override the default connection (different host/creds).</p>
        </div>
        {err && <div className="rounded border border-accent-red/40 bg-accent-red/10 px-2 py-1.5 font-mono text-xs text-accent-red">{err}</div>}
      </form>
    </Modal>
  );
}
