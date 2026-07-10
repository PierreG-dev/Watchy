import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from './env';
import { listBackups, updateBackup, deleteBackup } from './storage';
import { getEffectiveBackupDir } from './backup-path';

function ym(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function currentYm(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Retention policy:
 *  1) group successful backups by dbName + YYYY-MM
 *  2) for each past month with no protected backup, protect the most recent one
 *  3) delete non-protected backups older than BACKUP_RETENTION_DAYS
 */
export async function applyRetention(dbNames?: string[], baseDir?: string): Promise<{ protectedNow: number; deleted: number }> {
  const dir = baseDir ?? (await getEffectiveBackupDir()).dir;
  const all = await listBackups();
  const successes = all.filter((b) => b.status === 'success');
  const scope = dbNames && dbNames.length
    ? new Set(dbNames)
    : new Set(successes.map((b) => b.dbName));

  const groups = new Map<string, typeof successes>();
  for (const b of successes) {
    if (!scope.has(b.dbName)) continue;
    const key = `${b.dbName}|${ym(b.startedAt)}`;
    const arr = groups.get(key) ?? [];
    arr.push(b);
    groups.set(key, arr);
  }

  const cur = currentYm();
  let protectedNow = 0;
  for (const [key, group] of groups) {
    const month = key.split('|')[1];
    if (month === cur) continue; // don't protect the in-progress month
    if (group.some((g) => g.protected)) continue;
    const mostRecent = group.slice().sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    await updateBackup(mostRecent.id, { protected: true });
    protectedNow++;
  }

  const cutoff = Date.now() - env.BACKUP_RETENTION_DAYS * 24 * 3600 * 1000;
  let deleted = 0;
  for (const b of all) {
    if (b.protected) continue;
    if (!scope.has(b.dbName)) continue;
    if (b.status === 'running') continue;
    if (new Date(b.startedAt).getTime() >= cutoff) continue;
    await deleteBackupWithFile(b.id, b.relativePath, dir);
    deleted++;
  }

  return { protectedNow, deleted };
}

export async function deleteBackupWithFile(id: string, relativePath: string, baseDir?: string): Promise<void> {
  const dir = baseDir ?? (await getEffectiveBackupDir()).dir;
  const safe = path.resolve(dir);
  const abs = path.resolve(safe, relativePath);
  // Path traversal guard.
  if (!abs.startsWith(safe + path.sep) && abs !== safe) {
    throw new Error('Refused to delete outside backup directory');
  }
  try {
    await fs.unlink(abs);
  } catch (err: any) {
    if (err.code !== 'ENOENT') throw err;
  }
  await deleteBackup(id);
}
