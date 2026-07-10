import { runMongodump } from './mongodump';
import { insertBackup, updateBackup, newId, listTargets, getTarget, type Target, type BackupRun } from './storage';
import { applyRetention } from './retention';
import { sendFailureReport, type FailureSummary } from './mailer';
import { getEffectiveBackupDir } from './backup-path';

const currentlyRunning = new Set<string>(); // targetId set

export function isTargetRunning(targetId: string): boolean {
  return currentlyRunning.has(targetId);
}

export function runningTargetIds(): string[] {
  return Array.from(currentlyRunning);
}

async function runOne(target: Target, baseDir: string): Promise<{ ok: true; run: BackupRun } | { ok: false; error: string; run: BackupRun }> {
  const id = newId('bk');
  const startedAt = new Date().toISOString();
  const initial: BackupRun = {
    id,
    targetId: target.id,
    targetLabel: target.label,
    dbName: target.dbName,
    fileName: '',
    relativePath: '',
    sizeBytes: 0,
    startedAt,
    finishedAt: null,
    status: 'running',
    protected: false,
  };
  await insertBackup(initial);
  currentlyRunning.add(target.id);
  try {
    const dump = await runMongodump(target, baseDir);
    const updated = await updateBackup(id, {
      fileName: dump.fileName,
      relativePath: dump.relativePath,
      sizeBytes: dump.sizeBytes,
      status: 'success',
      finishedAt: new Date().toISOString(),
    });
    return { ok: true, run: updated ?? initial };
  } catch (err: any) {
    const errorMessage = (err?.message ?? String(err)).slice(0, 800);
    const updated = await updateBackup(id, {
      status: 'error',
      finishedAt: new Date().toISOString(),
      errorMessage,
    });
    return { ok: false, error: errorMessage, run: updated ?? initial };
  } finally {
    currentlyRunning.delete(target.id);
  }
}

export async function runTargetById(targetId: string): Promise<{ ok: boolean; error?: string }> {
  const target = await getTarget(targetId);
  if (!target) return { ok: false, error: 'Target not found' };
  const dirInfo = await getEffectiveBackupDir();
  if (!dirInfo.usable) return { ok: false, error: `No backup destination available: ${dirInfo.reason ?? 'select a disk in Settings'}` };
  const res = await runOne(target, dirInfo.dir);
  await applyRetention([target.dbName], dirInfo.dir);
  const failures: FailureSummary[] = res.ok ? [] : [{
    dbName: target.dbName,
    targetLabel: target.label,
    error: res.error,
    when: res.run.startedAt,
  }];
  if (failures.length) await sendFailureReport(failures);
  return { ok: res.ok, error: res.ok ? undefined : res.error };
}

export async function runAllTargets(): Promise<{ total: number; success: number; failed: number; skipped?: string }> {
  const targets = await listTargets();
  const dirInfo = await getEffectiveBackupDir();
  if (!dirInfo.usable) {
    return { total: targets.length, success: 0, failed: 0, skipped: `No backup destination available: ${dirInfo.reason ?? 'select a disk in Settings'}` };
  }
  const failures: FailureSummary[] = [];
  let success = 0;
  let failed = 0;
  // Serial: mongodump can be I/O heavy on a Pi with a single USB stick.
  for (const target of targets) {
    const res = await runOne(target, dirInfo.dir);
    if (res.ok) success++;
    else {
      failed++;
      failures.push({
        dbName: target.dbName,
        targetLabel: target.label,
        error: res.error,
        when: res.run.startedAt,
      });
    }
  }
  const dbNames = Array.from(new Set(targets.map((t) => t.dbName)));
  if (dbNames.length) await applyRetention(dbNames, dirInfo.dir);
  if (failures.length) await sendFailureReport(failures);
  return { total: targets.length, success, failed };
}
