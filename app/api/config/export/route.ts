import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { errorResponse } from '@/lib/http';
import { exportAll } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse | Response> {
  try {
    await requireSession();
    const payload = await exportAll();
    const body = JSON.stringify(payload, null, 2);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="watchy-export-${stamp}.json"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
