import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { env, isProd } from './env';

const COOKIE_NAME = 'watchy_session';
export const SESSION_TTL_SECONDS = 15 * 60; // 15 min sliding window

let cachedKey: Uint8Array | null = null;
function key(): Uint8Array {
  if (!cachedKey) cachedKey = new TextEncoder().encode(env.SESSION_SECRET);
  return cachedKey;
}

export interface SessionPayload {
  sub: string; // username
  iat: number;
  exp: number;
}

export async function createSessionToken(username: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ sub: username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_TTL_SECONDS)
    .sign(key());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number' || typeof payload.iat !== 'number') {
      return null;
    }
    return { sub: payload.sub, iat: payload.iat, exp: payload.exp };
  } catch {
    return null;
  }
}

function cookieSecure(): boolean {
  const v = process.env.SESSION_COOKIE_SECURE;
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return isProd();
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: 'strict' as const,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}

export async function setSessionCookie(username: string): Promise<void> {
  const token = await createSessionToken(username);
  cookies().set(COOKIE_NAME, token, cookieOptions());
}

export function clearSessionCookie(): void {
  cookies().set(COOKIE_NAME, '', { ...cookieOptions(), maxAge: 0 });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return await verifySessionToken(token);
}

/**
 * Require an authenticated session AND slide the expiration forward.
 * Called at the top of every protected API route.
 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    const err: any = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  // sliding window: reissue token on each authenticated request
  await setSessionCookie(session.sub);
  return session;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
