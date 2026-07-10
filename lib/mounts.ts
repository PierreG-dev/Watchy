import fs from 'node:fs/promises';
import path from 'node:path';
import checkDiskSpace from 'check-disk-space';
import { env } from './env';

export interface MountEntry {
  /** Directory name under MOUNTS_ROOT (e.g. "usb-backup"). */
  name: string;
  /** Absolute path inside the container. */
  path: string;
  /** True if this directory is a real mount point (device id differs from parent). */
  isMountPoint: boolean;
  /** Writable by the app process. */
  writable: boolean;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usedPercent: number;
}

/**
 * List candidate storage locations under MOUNTS_ROOT. Each subdirectory is a
 * potential backup destination — typically bind-mounted from /mnt on the host.
 * `isMountPoint` distinguishes a real filesystem mount from a stray dir.
 */
export async function listMounts(): Promise<MountEntry[]> {
  const root = env.MOUNTS_ROOT;
  let rootStat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    rootStat = await fs.stat(root);
  } catch {
    return [];
  }
  if (!rootStat.isDirectory()) return [];

  let entries: string[] = [];
  try {
    entries = await fs.readdir(root);
  } catch {
    return [];
  }

  const out: MountEntry[] = [];
  for (const name of entries) {
    if (name.startsWith('.')) continue;
    const abs = path.join(root, name);
    let st;
    try {
      st = await fs.stat(abs);
    } catch { continue; }
    if (!st.isDirectory()) continue;

    const isMountPoint = st.dev !== rootStat.dev;

    let writable = false;
    try {
      await fs.access(abs, (await import('node:fs')).constants.W_OK);
      writable = true;
    } catch { /* not writable */ }

    let disk = { size: 0, free: 0 };
    try {
      const info = await checkDiskSpace(abs);
      disk = { size: info.size, free: info.free };
    } catch { /* ignore */ }
    const used = Math.max(0, disk.size - disk.free);
    out.push({
      name,
      path: abs,
      isMountPoint,
      writable,
      totalBytes: disk.size,
      freeBytes: disk.free,
      usedBytes: used,
      usedPercent: disk.size > 0 ? (used / disk.size) * 100 : 0,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
