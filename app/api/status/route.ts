import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { errorResponse, json } from '@/lib/http';
import { listTargets, listBackups, type BackupRun } from '@/lib/storage';
import { getBackupDiskInfo } from '@/lib/disk';
import { env, smtpEnabled, defaultMongoConfigured } from '@/lib/env';
import { runningTargetIds } from '@/lib/runner';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    await requireSession();
    const [targets, allBackups, disk] = await Promise.all([
      listTargets(),
      listBackups(),
      getBackupDiskInfo().catch(() => null),
    ]);

    const running = new Set(runningTargetIds());
    const byTarget = new Map<string, BackupRun[]>();
    for (const b of allBackups) {
      const arr = byTarget.get(b.targetId) ?? [];
      arr.push(b);
      byTarget.set(b.targetId, arr);
    }

    const cards = targets.map((t) => {
      const runs = (byTarget.get(t.id) ?? []).slice().sort((a, b) => b.startedAt.localeCompare(a.startedAt));
      const last = runs.find((r) => r.status !== 'running') ?? null;
      const lastSuccess = runs.find((r) => r.status === 'success') ?? null;
      return {
        target: t,
        isRunning: running.has(t.id),
        lastStatus: last?.status ?? null,
        lastAt: last?.startedAt ?? null,
        lastError: last?.status === 'error' ? last.errorMessage ?? null : null,
        lastSuccessAt: lastSuccess?.startedAt ?? null,
        lastSuccessSize: lastSuccess?.sizeBytes ?? null,
        totalRuns: runs.length,
      };
    });

    return json({
      cards,
      disk,
      config: {
        cron: env.BACKUP_CRON,
        retentionDays: env.BACKUP_RETENTION_DAYS,
        tz: env.TZ,
        smtpEnabled: smtpEnabled(),
        mongoConfigured: defaultMongoConfigured(),
        backupDir: env.BACKUP_DIR,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
