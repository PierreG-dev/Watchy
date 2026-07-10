import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from './env';

export interface Target {
  id: string;
  label: string;
  dbName: string;
  customUri?: string; // if set, overrides the default connection
  createdAt: string;
  updatedAt: string;
}

export type BackupStatus = 'success' | 'error' | 'running';

export interface BackupRun {
  id: string;
  targetId: string;
  targetLabel: string;
  dbName: string;
  fileName: string;    // basename only, never a path
  relativePath: string; // <dbName>/<fileName> — inside BACKUP_DIR
  sizeBytes: number;
  startedAt: string;
  finishedAt: string | null;
  status: BackupStatus;
  errorMessage?: string;
  protected: boolean;
}

interface DbShape {
  targets: Target[];
  backups: BackupRun[];
  version: 1;
}

const emptyDb = (): DbShape => ({ targets: [], backups: [], version: 1 });

let cache: DbShape | null = null;
const writeQueue: Array<() => Promise<void>> = [];
let writing = false;

function dbFilePath(): string {
  return path.join(env.DATA_DIR, 'db.json');
}

async function ensureDirs(): Promise<void> {
  await fs.mkdir(env.DATA_DIR, { recursive: true });
  await fs.mkdir(env.BACKUP_DIR, { recursive: true });
}

async function load(): Promise<DbShape> {
  if (cache) return cache;
  await ensureDirs();
  const file = dbFilePath();
  try {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.targets) || !Array.isArray(parsed.backups)) {
      cache = emptyDb();
    } else {
      cache = { targets: parsed.targets, backups: parsed.backups, version: 1 };
    }
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      cache = emptyDb();
      await persist(cache);
    } else {
      throw err;
    }
  }
  return cache!;
}

async function persist(data: DbShape): Promise<void> {
  const file = dbFilePath();
  const tmp = file + '.tmp';
  const json = JSON.stringify(data, null, 2);
  await fs.writeFile(tmp, json, { mode: 0o600 });
  await fs.rename(tmp, file);
}

async function flushQueue(): Promise<void> {
  if (writing) return;
  writing = true;
  try {
    while (writeQueue.length) {
      const task = writeQueue.shift()!;
      await task();
    }
  } finally {
    writing = false;
  }
}

async function mutate(fn: (db: DbShape) => void | Promise<void>): Promise<void> {
  const db = await load();
  await fn(db);
  return new Promise<void>((resolve, reject) => {
    writeQueue.push(async () => {
      try {
        await persist(db);
        resolve();
      } catch (e) {
        reject(e);
      }
    });
    flushQueue();
  });
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(9).toString('base64url')}`;
}

// ------ Targets --------------------------------------------------------------

export async function listTargets(): Promise<Target[]> {
  const db = await load();
  return db.targets.slice().sort((a, b) => a.label.localeCompare(b.label));
}

export async function getTarget(id: string): Promise<Target | null> {
  const db = await load();
  return db.targets.find((t) => t.id === id) ?? null;
}

export async function createTarget(input: { label: string; dbName: string; customUri?: string }): Promise<Target> {
  const now = new Date().toISOString();
  const target: Target = {
    id: newId('tgt'),
    label: input.label.trim(),
    dbName: input.dbName.trim(),
    customUri: input.customUri?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  await mutate((db) => {
    db.targets.push(target);
  });
  return target;
}

export async function updateTarget(
  id: string,
  patch: Partial<Pick<Target, 'label' | 'dbName' | 'customUri'>>
): Promise<Target | null> {
  let updated: Target | null = null;
  await mutate((db) => {
    const t = db.targets.find((x) => x.id === id);
    if (!t) return;
    if (patch.label !== undefined) t.label = patch.label.trim();
    if (patch.dbName !== undefined) t.dbName = patch.dbName.trim();
    if (patch.customUri !== undefined) t.customUri = patch.customUri.trim() || undefined;
    t.updatedAt = new Date().toISOString();
    updated = t;
  });
  return updated;
}

export async function deleteTarget(id: string): Promise<boolean> {
  let removed = false;
  await mutate((db) => {
    const before = db.targets.length;
    db.targets = db.targets.filter((t) => t.id !== id);
    removed = db.targets.length !== before;
  });
  return removed;
}

// ------ Backups --------------------------------------------------------------

export async function listBackups(filter?: { targetId?: string; dbName?: string }): Promise<BackupRun[]> {
  const db = await load();
  let out = db.backups.slice();
  if (filter?.targetId) out = out.filter((b) => b.targetId === filter.targetId);
  if (filter?.dbName) out = out.filter((b) => b.dbName === filter.dbName);
  return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function getBackup(id: string): Promise<BackupRun | null> {
  const db = await load();
  return db.backups.find((b) => b.id === id) ?? null;
}

export async function insertBackup(run: BackupRun): Promise<void> {
  await mutate((db) => {
    db.backups.push(run);
  });
}

export async function updateBackup(id: string, patch: Partial<BackupRun>): Promise<BackupRun | null> {
  let updated: BackupRun | null = null;
  await mutate((db) => {
    const b = db.backups.find((x) => x.id === id);
    if (!b) return;
    Object.assign(b, patch);
    updated = b;
  });
  return updated;
}

export async function deleteBackup(id: string): Promise<BackupRun | null> {
  let removed: BackupRun | null = null;
  await mutate((db) => {
    const idx = db.backups.findIndex((x) => x.id === id);
    if (idx === -1) return;
    removed = db.backups[idx];
    db.backups.splice(idx, 1);
  });
  return removed;
}

// ------ Import / Export ------------------------------------------------------

export interface ExportPayload {
  version: 1;
  exportedAt: string;
  targets: Target[];
  backups: BackupRun[];
}

export async function exportAll(): Promise<ExportPayload> {
  const db = await load();
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    targets: db.targets,
    backups: db.backups,
  };
}

export async function importAll(payload: ExportPayload, mode: 'replace' | 'merge'): Promise<{ targets: number; backups: number }> {
  if (!payload || payload.version !== 1 || !Array.isArray(payload.targets) || !Array.isArray(payload.backups)) {
    throw new Error('Invalid export payload');
  }
  await mutate((db) => {
    if (mode === 'replace') {
      db.targets = payload.targets;
      db.backups = payload.backups;
      return;
    }
    const byId = new Map(db.targets.map((t) => [t.id, t]));
    for (const t of payload.targets) byId.set(t.id, t);
    db.targets = Array.from(byId.values());
    const bIds = new Map(db.backups.map((b) => [b.id, b]));
    for (const b of payload.backups) bIds.set(b.id, b);
    db.backups = Array.from(bIds.values());
  });
  return { targets: payload.targets.length, backups: payload.backups.length };
}

// Warm on module load in the server process.
try {
  fssync.mkdirSync(env.DATA_DIR, { recursive: true });
  fssync.mkdirSync(env.BACKUP_DIR, { recursive: true });
} catch {
  /* ignore, will be caught on first async call */
}
