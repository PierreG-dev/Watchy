import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { errorResponse, json } from '@/lib/http';
import { importAll } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<NextResponse> {
  try {
    await requireSession();
    const body = await req.json().catch(() => null);
    if (!body?.payload) return json({ error: 'Missing payload' }, 400);
    const mode = body.mode === 'replace' ? 'replace' : 'merge';
    const res = await importAll(body.payload, mode);
    return json({ ok: true, ...res });
  } catch (err: any) {
    return json({ error: err?.message ?? 'Import failed' }, 400);
  }
}
