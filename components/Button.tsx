'use client';
import { cn } from '@/lib/ui/cn';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'danger' | 'subtle';
type Size = 'sm' | 'md';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/40 hover:bg-accent-cyan/25',
  ghost: 'bg-transparent text-fg-muted border-bg-border hover:text-fg hover:border-fg-muted',
  subtle: 'bg-bg-raised text-fg border-bg-border hover:border-fg-muted',
  danger: 'bg-accent-red/10 text-accent-red border-accent-red/40 hover:bg-accent-red/20',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-xs',
  md: 'h-9 px-3.5 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = 'ghost', size = 'md', loading, disabled, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
});
