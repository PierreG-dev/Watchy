/**
 * Next.js instrumentation hook — runs once at server boot.
 * Used here to start the node-cron scheduler and emit an SMTP warning
 * if email notifications are disabled.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startScheduler } = await import('./lib/scheduler');
  const { warnIfSmtpDisabled } = await import('./lib/mailer');
  warnIfSmtpDisabled();
  startScheduler();
}
