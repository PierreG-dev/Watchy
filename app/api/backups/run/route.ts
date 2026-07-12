import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { errorResponse, json } from '@/lib/http';
import { runAllTargets } from '@/lib/runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 60 * 60;

export async function POST(): Promise<NextResponse> {
  try {
    await requireSession();
    const res = await runAllTargets();
    return json(res);
  } catch (err) {
    return errorResponse(err);
  }
}
