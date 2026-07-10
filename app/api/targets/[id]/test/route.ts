import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { errorResponse, json } from '@/lib/http';
import { getTarget } from '@/lib/storage';
import { testConnection } from '@/lib/mongo';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    await requireSession();
    const t = await getTarget(params.id);
    if (!t) return json({ error: 'Not found' }, 404);
    const res = await testConnection(t);
    return json(res);
  } catch (err) {
    return errorResponse(err);
  }
}
