import path from 'node:path';

/**
 * Env accessor — validated lazily on first field access so that `next build`,
 * which imports server modules without runtime env vars, does not crash.
 * All keys are still required at *runtime*.
 */

function req(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}
function opt(name: string, def = ''): string {
  const v = process.env[name];
  return v === undefined || v === '' ? def : v;
}
function optInt(name: string, def: number): number {
  const v = process.env[name];
  if (!v) return def;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}
function optBool(name: string, def: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return def;
  return v === 'true' || v === '1' || v === 'yes';
}

const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

function reqSafe(name: string): string {
  if (isBuildPhase) return process.env[name] ?? '';
  return req(name);
}

export const env = {
  get APP_USERNAME() { return reqSafe('APP_USERNAME'); },
  get APP_PASSWORD_HASH() { return reqSafe('APP_PASSWORD_HASH'); },
  get SESSION_SECRET() { return reqSafe('SESSION_SECRET'); },

  get MONGO_HOST() { return opt('MONGO_HOST', '127.0.0.1'); },
  get MONGO_PORT() { return optInt('MONGO_PORT', 27017); },
  get MONGO_USERNAME() { return opt('MONGO_USERNAME'); },
  get MONGO_PASSWORD() { return opt('MONGO_PASSWORD'); },
  get MONGO_AUTH_SOURCE() { return opt('MONGO_AUTH_SOURCE', 'admin'); },
  get MONGO_EXTRA_OPTIONS() { return opt('MONGO_EXTRA_OPTIONS'); },

  get BACKUP_CRON() { return opt('BACKUP_CRON', '0 3 * * *'); },
  get BACKUP_RETENTION_DAYS() { return optInt('BACKUP_RETENTION_DAYS', 90); },
  get TZ() { return opt('TZ', 'UTC'); },

  get DATA_DIR() { return path.resolve(opt('DATA_DIR', path.join(process.cwd(), 'data'))); },
  get BACKUP_DIR() { return path.resolve(opt('BACKUP_DIR', path.join(process.cwd(), 'backups'))); },
  /** Parent bind mount that lets Watchy see the host's mount points (e.g. /mnt). */
  get MOUNTS_ROOT() { return path.resolve(opt('MOUNTS_ROOT', path.join(process.cwd(), 'mounts'))); },

  get SMTP_HOST() { return opt('SMTP_HOST'); },
  get SMTP_PORT() { return optInt('SMTP_PORT', 587); },
  get SMTP_SECURE() { return optBool('SMTP_SECURE', false); },
  get SMTP_USER() { return opt('SMTP_USER'); },
  get SMTP_PASS() { return opt('SMTP_PASS'); },
  get SMTP_FROM() { return opt('SMTP_FROM'); },
  get SMTP_TO() { return opt('SMTP_TO'); },

  get PORT() { return optInt('PORT', 3000); },
  get NODE_ENV() { return opt('NODE_ENV', 'development'); },
};

export const isProd = () => process.env.NODE_ENV === 'production';
export const smtpEnabled = () => !!process.env.SMTP_HOST && !!process.env.SMTP_TO;
export const defaultMongoConfigured = () => !!process.env.MONGO_HOST;
