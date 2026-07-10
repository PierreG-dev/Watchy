import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Edge middleware — guards every non-public route and enforces a CSRF
 * header on mutating API calls (defense-in-depth on top of SameSite=Strict).
 *
 * We do NOT import from ./lib/* here because those modules pull in Node core
 * APIs (fs, path, child_process) that aren't available in the edge runtime.
 * Session verification is done inline with jose.
 */

const SESSION_COOKIE = 'watchy_session';

let cachedKey: Uint8Array | null = null;
function key(): Uint8Array {
  if (!cachedKey) {
    const secret = process.env.SESSION_SECRET;
    if (!secret) throw new Error('SESSION_SECRET is not set');
    cachedKey = new TextEncoder().encode(secret);
  }
  return cachedKey;
}

const PUBLIC_PATHS = new Set<string>(['/login', '/api/auth/login', '/api/healthz']);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith('/_next')) return true;
  if (pathname === '/favicon.ico') return true;
  return false;
}

async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, key(), { algorithms: ['HS256'] });
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const ok = await isValidSession(req.cookies.get(SESSION_COOKIE)?.value);

  if (!ok) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith('/api/') && req.method !== 'GET' && req.method !== 'HEAD') {
    if (req.headers.get('x-watchy-csrf') !== '1') {
      return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 });
    }
  }

  const res = NextResponse.next();
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'no-referrer');
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
