import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { errorResponse, json } from '@/lib/http';
import { getBackup } from '@/lib/storage';
import { deleteBackupWithFile } from '@/lib/retention';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    await requireSession();
    const b = await getBackup(params.id);
    if (!b) return json({ error: 'Not found' }, 404);
    if (b.protected) return json({ error: 'Protected backups cannot be deleted' }, 409);
    if (b.status === 'running') return json({ error: 'Backup is still running' }, 409);
    await deleteBackupWithFile(b.id, b.relativePath);
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
