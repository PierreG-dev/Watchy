import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { verifyPassword, timingSafeStringEqual } from '@/lib/password';
import { setSessionCookie } from '@/lib/session';
import { checkLoginRateLimit, recordFailedLogin, recordSuccessfulLogin } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<NextResponse> {
  const ip = getClientIp(req);
  const rl = checkLoginRateLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${rl.retryAfterSeconds}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    recordFailedLogin(ip);
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const username = typeof body?.username === 'string' ? body.username : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  const userOk = timingSafeStringEqual(username, env.APP_USERNAME);
  const passOk = await verifyPassword(password, env.APP_PASSWORD_HASH);

  if (!userOk || !passOk) {
    recordFailedLogin(ip);
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  recordSuccessfulLogin(ip);
  await setSessionCookie(env.APP_USERNAME);
  return NextResponse.json({ ok: true });
}
