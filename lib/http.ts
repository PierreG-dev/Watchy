import { NextResponse } from 'next/server';

export function json<T>(data: T, init?: number | ResponseInit): NextResponse {
  return NextResponse.json(data, typeof init === 'number' ? { status: init } : init);
}

export function errorResponse(err: unknown): NextResponse {
  const status = (err as any)?.status ?? 500;
  const message = (err as any)?.message ?? 'Internal error';
  return NextResponse.json({ error: message }, { status });
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}
