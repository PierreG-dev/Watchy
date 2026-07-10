import cron from 'node-cron';
import { env } from './env';
import { runAllTargets } from './runner';

let started = false;
let task: cron.ScheduledTask | null = null;

export function startScheduler(): void {
  if (started) return;
  started = true;
  if (!cron.validate(env.BACKUP_CRON)) {
    console.error(`[watchy] invalid BACKUP_CRON "${env.BACKUP_CRON}" — scheduler NOT started.`);
    return;
  }
  task = cron.schedule(
    env.BACKUP_CRON,
    async () => {
      console.log(`[watchy] scheduled backup run starting at ${new Date().toISOString()}`);
      try {
        const res = await runAllTargets();
        console.log(`[watchy] scheduled run finished: ${res.success}/${res.total} ok, ${res.failed} failed`);
      } catch (err: any) {
        console.error('[watchy] scheduled run crashed:', err?.message ?? err);
      }
    },
    { timezone: env.TZ }
  );
  console.log(`[watchy] scheduler started — cron="${env.BACKUP_CRON}" tz="${env.TZ}"`);
}

export function stopScheduler(): void {
  task?.stop();
  task = null;
  started = false;
}
