import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { errorResponse, json } from '@/lib/http';
import { listBackups } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<NextResponse> {
  try {
    await requireSession();
    const url = new URL(req.url);
    const targetId = url.searchParams.get('targetId') || undefined;
    const dbName = url.searchParams.get('dbName') || undefined;
    const backups = await listBackups({ targetId, dbName });
    return json({ backups });
  } catch (err) {
    return errorResponse(err);
  }
}
