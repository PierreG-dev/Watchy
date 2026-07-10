import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { errorResponse, json } from '@/lib/http';
import { listMounts } from '@/lib/mounts';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    await requireSession();
    const mounts = await listMounts();
    return json({ mounts, root: env.MOUNTS_ROOT });
  } catch (err) {
    return errorResponse(err);
  }
}
