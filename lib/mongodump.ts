import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { env } from './env';
import { buildUri } from './mongo';
import type { Target } from './storage';

export interface DumpResult {
  fileName: string;
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
}

/**
 * Run mongodump for a target. Writes a gzipped archive into BACKUP_DIR/<dbName>/.
 * URI is passed via a 0600 temp config file so it never appears in `ps aux`.
 */
export async function runMongodump(target: Target): Promise<DumpResult> {
  const uri = buildUri(target);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeDb = target.dbName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${safeDb}_${stamp}.gz`;
  const dbDir = path.join(env.BACKUP_DIR, safeDb);
  await fs.mkdir(dbDir, { recursive: true });
  const absolutePath = path.join(dbDir, fileName);
  const relativePath = path.join(safeDb, fileName);

  const tmpConfig = path.join(os.tmpdir(), `watchy-${crypto.randomBytes(8).toString('hex')}.yaml`);
  const configContent = `uri: "${uri.replace(/"/g, '\\"')}"\n`;
  await fs.writeFile(tmpConfig, configContent, { mode: 0o600 });

  try {
    await execMongodump([
      `--config=${tmpConfig}`,
      `--db=${target.dbName}`,
      `--archive=${absolutePath}`,
      '--gzip',
      '--quiet',
    ]);
  } finally {
    try { await fs.unlink(tmpConfig); } catch { /* ignore */ }
  }

  const stat = await fs.stat(absolutePath);
  return { fileName, relativePath, absolutePath, sizeBytes: stat.size };
}

function execMongodump(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('mongodump', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.stdout.on('data', () => { /* silent */ });
    child.on('error', (err) => reject(new Error(`mongodump failed to start: ${err.message}`)));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`mongodump exited with code ${code}: ${stderr.trim().slice(0, 400)}`));
    });
  });
}
