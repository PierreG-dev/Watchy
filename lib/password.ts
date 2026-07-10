import { argon2id, argon2Verify } from 'hash-wasm';
import crypto from 'node:crypto';

const ARGON_OPTIONS = {
  parallelism: 1,
  iterations: 3,
  memorySize: 65536, // 64 MB — safe on RPi 4 (4 GB)
  hashLength: 32,
  outputType: 'encoded' as const,
};

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  return argon2id({ ...ARGON_OPTIONS, password, salt });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2Verify({ password, hash });
  } catch {
    return false;
  }
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // still do a comparison to keep timing similar
    crypto.timingSafeEqual(ab, ab);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}
