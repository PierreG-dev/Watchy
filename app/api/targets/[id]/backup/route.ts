import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { errorResponse, json } from '@/lib/http';
import { runTargetById } from '@/lib/runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 60 * 60; // 1h — big dumps

export async function POST(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    await requireSession();
    const res = await runTargetById(params.id);
    if (!res.ok) return json({ error: res.error ?? 'Backup failed' }, 500);
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
