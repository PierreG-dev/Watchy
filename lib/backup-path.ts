import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from './env';
import { getSettings } from './storage';

/** Subfolder Watchy creates inside the chosen disk to keep its files together. */
export const BACKUP_ROOT_NAME = 'Watchy';

/**
 * Resolve the directory dumps must be written to / read from.
 *
 * Priority:
 *   1. `settings.backupDir` (chosen from the UI) if it resolves inside
 *      MOUNTS_ROOT and is a writable directory.
 *   2. `env.BACKUP_DIR` fallback (dev / backward compat).
 *
 * We ALWAYS validate that the chosen path lives inside MOUNTS_ROOT — the
 * setting comes from the DB which came from an authenticated request, but
 * defense-in-depth against a corrupted db.json or a bad import.
 */
export async function getEffectiveBackupDir(): Promise<{ dir: string; source: 'setting' | 'env'; usable: boolean; reason?: string }> {
  const settings = await getSettings();
  if (settings.backupDir) {
    const abs = path.resolve(settings.backupDir);
    const root = path.resolve(env.MOUNTS_ROOT);
    const inside = abs === root || abs.startsWith(root + path.sep);
    if (!inside) {
      return { dir: env.BACKUP_DIR, source: 'env', usable: false, reason: 'Selected path is outside MOUNTS_ROOT' };
    }
    try {
      const st = await fs.stat(abs);
      if (!st.isDirectory()) return { dir: abs, source: 'setting', usable: false, reason: 'Selected path is not a directory' };
      await fs.access(abs, (await import('node:fs')).constants.W_OK);
      // Always write into a `Watchy/` subdir so we don't litter the root of
      // the user's disk. Created on demand by mongodump/mkdir.
      const dir = path.join(abs, BACKUP_ROOT_NAME);
      try { await fs.mkdir(dir, { recursive: true }); } catch { /* handled at write time */ }
      return { dir, source: 'setting', usable: true };
    } catch (err: any) {
      return { dir: abs, source: 'setting', usable: false, reason: err?.message ?? 'Unavailable' };
    }
  }
  // Fallback: env-provided BACKUP_DIR (dev). No Watchy/ subdir here — the
  // fallback path is already an app-owned directory.
  return { dir: env.BACKUP_DIR, source: 'env', usable: true };
}

/** Same as above, but throws if the destination cannot be used. */
export async function requireBackupDir(): Promise<string> {
  const info = await getEffectiveBackupDir();
  if (!info.usable) {
    const err: any = new Error(`Backup destination unavailable: ${info.reason ?? 'no disk selected'}`);
    err.status = 400;
    throw err;
  }
  return info.dir;
}
