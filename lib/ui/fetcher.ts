export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const method = (init.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    headers.set('X-Watchy-CSRF', '1');
    if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
  }
  const res = await fetch(input, { ...init, headers, credentials: 'same-origin' });
  if (res.status === 401 && typeof window !== 'undefined') {
    window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname);
  }
  return res;
}

export async function apiJson<T>(input: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(input, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}
