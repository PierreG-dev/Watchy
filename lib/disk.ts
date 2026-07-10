import checkDiskSpace from 'check-disk-space';

export interface DiskInfo {
  path: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usedPercent: number;
}

export async function getBackupDiskInfo(dir: string): Promise<DiskInfo> {
  const info = await checkDiskSpace(dir);
  const used = info.size - info.free;
  return {
    path: dir,
    totalBytes: info.size,
    freeBytes: info.free,
    usedBytes: used,
    usedPercent: info.size > 0 ? (used / info.size) * 100 : 0,
  };
}
