import { NextResponse } from 'next/server';
import { clearSessionCookie, requireSession } from '@/lib/session';
import { errorResponse } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function POST(): Promise<NextResponse> {
  try {
    await requireSession();
    clearSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
