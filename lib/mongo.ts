import { MongoClient } from 'mongodb';
import { env } from './env';
import type { Target } from './storage';

/**
 * Build a MongoDB URI for a target, either from its customUri or from the
 * default connection env. Password is URL-encoded.
 */
export function buildUri(target: Pick<Target, 'dbName' | 'customUri'>): string {
  if (target.customUri && target.customUri.trim()) return target.customUri.trim();
  const user = env.MONGO_USERNAME;
  const pass = env.MONGO_PASSWORD;
  const host = env.MONGO_HOST;
  const port = env.MONGO_PORT;
  const db = encodeURIComponent(target.dbName);
  const authSource = env.MONGO_AUTH_SOURCE;
  const extra = env.MONGO_EXTRA_OPTIONS;
  const auth = user ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@` : '';
  const params = new URLSearchParams();
  if (authSource) params.set('authSource', authSource);
  if (extra) {
    for (const part of extra.split('&')) {
      const [k, v] = part.split('=');
      if (k) params.set(k, v ?? '');
    }
  }
  const qs = params.toString();
  return `mongodb://${auth}${host}:${port}/${db}${qs ? `?${qs}` : ''}`;
}

export async function testConnection(target: Pick<Target, 'dbName' | 'customUri'>): Promise<{ ok: true } | { ok: false; error: string }> {
  const uri = buildUri(target);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    await client.db(target.dbName).command({ ping: 1 });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) };
  } finally {
    try { await client.close(); } catch { /* ignore */ }
  }
}
