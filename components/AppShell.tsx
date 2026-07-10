'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Database, History, Settings, LogOut, Radio } from 'lucide-react';
import { apiFetch } from '@/lib/ui/fetcher';
import { cn } from '@/lib/ui/cn';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/targets', label: 'Targets', icon: Database },
  { href: '/history', label: 'History', icon: History },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  async function logout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/login';
    }
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex w-56 flex-col border-r border-bg-border bg-bg-panel">
        <div className="flex items-center gap-2 border-b border-bg-border px-4 py-4">
          <Radio className="h-5 w-5 text-accent-cyan" />
          <div className="font-mono text-sm font-semibold tracking-wider">WATCHY</div>
        </div>
        <nav className="flex-1 p-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  active ? 'bg-bg-raised text-fg' : 'text-fg-muted hover:bg-bg-raised/50 hover:text-fg'
                )}
              >
                <Icon className={cn('h-4 w-4', active && 'text-accent-cyan')} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-bg-border p-2">
          <button
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-bg-raised/50 hover:text-fg"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="md:hidden fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-bg-border bg-bg-panel px-3 py-2">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-accent-cyan" />
          <span className="font-mono text-sm font-semibold">WATCHY</span>
        </div>
        <nav className="flex gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-md',
                  active ? 'bg-bg-raised text-accent-cyan' : 'text-fg-muted'
                )}
              >
                <Icon className="h-4 w-4" />
              </Link>
            );
          })}
          <button onClick={logout} aria-label="Log out" className="flex h-8 w-8 items-center justify-center rounded-md text-fg-muted">
            <LogOut className="h-4 w-4" />
          </button>
        </nav>
      </div>

      <main className="flex-1 pt-14 md:pt-0">
        <div className="mx-auto max-w-6xl p-4 sm:p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
