'use client';
import { cn } from '@/lib/ui/cn';
import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const baseInput =
  'w-full rounded-md border border-bg-border bg-bg-raised px-3 py-2 text-sm text-fg placeholder:text-fg-faint focus:border-accent-cyan focus:outline-none';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }>(function Input(
  { className, mono, ...rest },
  ref
) {
  return <input ref={ref} className={cn(baseInput, mono && 'font-mono', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref
) {
  return <textarea ref={ref} className={cn(baseInput, 'font-mono min-h-24', className)} {...rest} />;
});

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-fg-muted">
      {children}
    </label>
  );
}
