import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { errorResponse, json } from '@/lib/http';
import { createTarget, listTargets } from '@/lib/storage';

export const dynamic = 'force-dynamic';

function validateInput(body: any): { label: string; dbName: string; customUri?: string } | string {
  const label = typeof body?.label === 'string' ? body.label.trim() : '';
  const dbName = typeof body?.dbName === 'string' ? body.dbName.trim() : '';
  const customUri = typeof body?.customUri === 'string' ? body.customUri.trim() : '';
  if (!label) return 'label is required';
  if (label.length > 100) return 'label too long';
  if (!dbName) return 'dbName is required';
  if (!/^[a-zA-Z0-9_.-]{1,120}$/.test(dbName)) return 'dbName contains invalid characters';
  if (customUri && !/^mongodb(\+srv)?:\/\//i.test(customUri)) return 'customUri must start with mongodb:// or mongodb+srv://';
  return { label, dbName, customUri: customUri || undefined };
}

export async function GET(): Promise<NextResponse> {
  try {
    await requireSession();
    const targets = await listTargets();
    return json({ targets });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    await requireSession();
    const body = await req.json().catch(() => null);
    const v = validateInput(body);
    if (typeof v === 'string') return json({ error: v }, 400);
    const target = await createTarget(v);
    return json({ target }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
