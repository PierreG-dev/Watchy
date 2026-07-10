'use client';
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/ui/cn';

export function Modal({ open, onClose, title, children, footer, wide }: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={cn('relative w-full rounded-lg border border-bg-border bg-bg-panel shadow-panel', wide ? 'max-w-2xl' : 'max-w-md')}>
        <header className="flex items-center justify-between border-b border-bg-border px-4 py-3">
          <h3 className="font-mono text-xs uppercase tracking-[0.14em] text-fg-muted">{title}</h3>
          <button onClick={onClose} className="text-fg-muted hover:text-fg" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="p-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-bg-border px-4 py-3">{footer}</footer>}
      </div>
    </div>
  );
}
