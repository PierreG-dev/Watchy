import { cn } from '@/lib/ui/cn';
import type { ReactNode } from 'react';

export function Panel({ children, className, title, right, dense }: { children: ReactNode; className?: string; title?: ReactNode; right?: ReactNode; dense?: boolean }) {
  return (
    <section className={cn('rounded-lg border border-bg-border bg-bg-panel shadow-panel', className)}>
      {(title || right) && (
        <header className="flex items-center justify-between border-b border-bg-border px-4 py-3">
          <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-fg-muted">{title}</h2>
          {right}
        </header>
      )}
      <div className={cn(dense ? 'p-3' : 'p-4')}>{children}</div>
    </section>
  );
}
