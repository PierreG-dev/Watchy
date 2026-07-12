import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import { stat } from 'node:fs/promises';
import { requireSession } from '@/lib/session';
import { errorResponse, json } from '@/lib/http';
import { getBackup } from '@/lib/storage';
import { getEffectiveBackupDir } from '@/lib/backup-path';

export const dynamic = 'force-dynamic';

/**
 * Streams the dump file from BACKUP_DIR to the browser. The requested path is
 * *never* trusted from the URL: we look up the backup by id, then resolve
 * the file inside BACKUP_DIR and refuse anything outside of it.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }): Promise<Response> {
  try {
    await requireSession();
    const b = await getBackup(params.id);
    if (!b || b.status !== 'success') return json({ error: 'Not found' }, 404);

    const info = await getEffectiveBackupDir();
    const baseAbs = path.resolve(info.dir);
    const fileAbs = path.resolve(baseAbs, b.relativePath);
    if (!fileAbs.startsWith(baseAbs + path.sep) && fileAbs !== baseAbs) {
      return json({ error: 'Forbidden' }, 403);
    }
    const st = await stat(fileAbs).catch(() => null);
    if (!st || !st.isFile()) return json({ error: 'File missing' }, 410);

    const stream = fs.createReadStream(fileAbs);
    // @ts-expect-error — Node Readable is acceptable as a body in Next runtime.
    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Length': String(st.size),
        'Content-Disposition': `attachment; filename="${encodeURIComponent(b.fileName)}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
