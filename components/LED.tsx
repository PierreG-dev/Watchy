import { cn } from '@/lib/ui/cn';

type Tone = 'green' | 'red' | 'amber' | 'cyan' | 'off';

const TONE_CLASS: Record<Tone, string> = {
  green: 'text-accent-green',
  red: 'text-accent-red',
  amber: 'text-accent-amber',
  cyan: 'text-accent-cyan',
  off: 'text-fg-faint',
};

export function LED({ tone = 'off', pulse = false, size = 8, label }: { tone?: Tone; pulse?: boolean; size?: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-fg-muted" role={label ? 'status' : undefined} aria-label={label}>
      <span
        aria-hidden
        className={cn('rounded-full', TONE_CLASS[tone], pulse && 'animate-pulse-led')}
        style={{
          width: size,
          height: size,
          backgroundColor: 'currentColor',
          boxShadow: tone === 'off' ? 'none' : '0 0 8px currentColor',
        }}
      />
      {label && <span>{label}</span>}
    </span>
  );
}
