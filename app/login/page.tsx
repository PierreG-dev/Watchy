'use client';
import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Radio, Lock, User } from 'lucide-react';
import { Button } from '@/components/Button';
import { Input, Label } from '@/components/Input';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') ?? '/';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Watchy-CSRF': '1' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      router.replace(next.startsWith('/') ? next : '/');
    } catch (err: any) {
      setError(err.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-grid flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg-base pointer-events-none" />
      <div className="relative w-full max-w-sm rounded-lg border border-bg-border bg-bg-panel/95 shadow-panel backdrop-blur">
        <div className="flex items-center gap-2 border-b border-bg-border px-5 py-4">
          <Radio className="h-5 w-5 text-accent-cyan" />
          <div>
            <div className="font-mono text-sm font-semibold tracking-widest">WATCHY</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-fg-muted">Backup console · login</div>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 p-5">
          <div>
            <Label htmlFor="u">Username</Label>
            <div className="relative">
              <User className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-faint" />
              <Input
                id="u"
                mono
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-8"
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="p">Password</Label>
            <div className="relative">
              <Lock className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-faint" />
              <Input
                id="p"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-8"
                required
              />
            </div>
          </div>
          {error && (
            <div className="rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 font-mono text-xs text-accent-red">
              {error}
            </div>
          )}
          <Button type="submit" variant="primary" loading={loading} className="w-full">
            Sign in
          </Button>
          <p className="text-center font-mono text-[10px] uppercase tracking-[0.15em] text-fg-faint">
            Session expires after 15 min of inactivity
          </p>
        </form>
      </div>
    </div>
  );
}
