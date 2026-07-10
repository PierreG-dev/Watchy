import nodemailer, { type Transporter } from 'nodemailer';
import { env, smtpEnabled } from './env';

let transporter: Transporter | null = null;
let warned = false;

function getTransport(): Transporter | null {
  if (!smtpEnabled()) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

export function warnIfSmtpDisabled(): void {
  if (smtpEnabled() || warned) return;
  warned = true;
  console.warn('[watchy] SMTP is not configured — email notifications are disabled.');
}

export interface FailureSummary {
  dbName: string;
  targetLabel: string;
  error: string;
  when: string;
}

export async function sendFailureReport(failures: FailureSummary[]): Promise<void> {
  if (!failures.length) return;
  const t = getTransport();
  if (!t) return;
  const subject = `[Watchy] ${failures.length} backup failure${failures.length > 1 ? 's' : ''}`;
  const lines = failures.map(
    (f) => `• ${f.targetLabel} (${f.dbName}) — ${f.when}\n    ${f.error.slice(0, 400)}`
  );
  const text = `Watchy backup run reported ${failures.length} failure(s):\n\n${lines.join('\n\n')}\n`;
  try {
    await t.sendMail({
      from: env.SMTP_FROM || env.SMTP_USER || 'watchy@localhost',
      to: env.SMTP_TO,
      subject,
      text,
    });
  } catch (err: any) {
    console.error('[watchy] failed to send failure email:', err?.message ?? err);
  }
}
