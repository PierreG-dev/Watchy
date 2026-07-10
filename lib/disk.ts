import checkDiskSpace from 'check-disk-space';
import { env } from './env';

export interface DiskInfo {
  path: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usedPercent: number;
}

export async function getBackupDiskInfo(): Promise<DiskInfo> {
  const info = await checkDiskSpace(env.BACKUP_DIR);
  const used = info.size - info.free;
  return {
    path: env.BACKUP_DIR,
    totalBytes: info.size,
    freeBytes: info.free,
    usedBytes: used,
    usedPercent: info.size > 0 ? (used / info.size) * 100 : 0,
  };
}
