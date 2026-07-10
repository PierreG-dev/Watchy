import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs/promises';
import { requireSession } from '@/lib/session';
import { errorResponse, json } from '@/lib/http';
import { getSettings, updateSettings } from '@/lib/storage';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    await requireSession();
    return json({ settings: await getSettings() });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request): Promise<NextResponse> {
  try {
    await requireSession();
    const body = await req.json().catch(() => ({}));
    const patch: { backupDir?: string | null } = {};

    if ('backupDir' in body) {
      if (body.backupDir === null) {
        patch.backupDir = null;
      } else if (typeof body.backupDir === 'string') {
        const abs = path.resolve(body.backupDir);
        const root = path.resolve(env.MOUNTS_ROOT);
        // Only paths under MOUNTS_ROOT are accepted — the setting comes from
        // an authenticated user but we still refuse arbitrary paths.
        if (abs !== root && !abs.startsWith(root + path.sep)) {
          return json({ error: 'backupDir must be inside MOUNTS_ROOT' }, 400);
        }
        try {
          const st = await fs.stat(abs);
          if (!st.isDirectory()) return json({ error: 'backupDir is not a directory' }, 400);
        } catch {
          return json({ error: 'backupDir does not exist' }, 400);
        }
        patch.backupDir = abs;
      } else {
        return json({ error: 'backupDir must be a string or null' }, 400);
      }
    }

    const updated = await updateSettings(patch);
    return json({ settings: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
