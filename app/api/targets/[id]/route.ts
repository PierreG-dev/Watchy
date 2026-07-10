import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { errorResponse, json } from '@/lib/http';
import { deleteTarget, getTarget, updateTarget } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    await requireSession();
    const t = await getTarget(params.id);
    if (!t) return json({ error: 'Not found' }, 404);
    return json({ target: t });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    await requireSession();
    const body = await req.json().catch(() => ({}));
    const patch: any = {};
    if (typeof body.label === 'string') {
      const label = body.label.trim();
      if (!label || label.length > 100) return json({ error: 'invalid label' }, 400);
      patch.label = label;
    }
    if (typeof body.dbName === 'string') {
      const dbName = body.dbName.trim();
      if (!/^[a-zA-Z0-9_.-]{1,120}$/.test(dbName)) return json({ error: 'invalid dbName' }, 400);
      patch.dbName = dbName;
    }
    if (typeof body.customUri === 'string') {
      const customUri = body.customUri.trim();
      if (customUri && !/^mongodb(\+srv)?:\/\//i.test(customUri)) return json({ error: 'invalid customUri' }, 400);
      patch.customUri = customUri;
    }
    const t = await updateTarget(params.id, patch);
    if (!t) return json({ error: 'Not found' }, 404);
    return json({ target: t });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    await requireSession();
    const ok = await deleteTarget(params.id);
    if (!ok) return json({ error: 'Not found' }, 404);
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
