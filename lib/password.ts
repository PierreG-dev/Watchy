import { argon2id } from 'hash-wasm';
import crypto from 'node:crypto';

const ARGON_OPTIONS = {
  parallelism: 1,
  iterations: 3,
  memorySize: 65536,
  hashLength: 32,
  outputType: 'hex' as const,
};

// Storage format: "<saltHex>:<hashHex>". Hex only — no `$` so it survives
// every layer of env var interpolation (dotenv-expand, docker-compose, Coolify).
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await argon2id({ ...ARGON_OPTIONS, password, salt });
  return `${salt.toString('hex')}:${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, expectedHex] = stored.split(':');
  if (!saltHex || !expectedHex) return false;
  let salt: Buffer;
  try {
    salt = Buffer.from(saltHex, 'hex');
  } catch {
    return false;
  }
  if (salt.length === 0) return false;
  const got = await argon2id({ ...ARGON_OPTIONS, password, salt });
  return timingSafeStringEqual(got, expectedHex);
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    crypto.timingSafeEqual(ab, ab);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}
