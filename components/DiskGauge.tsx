'use client';
import { formatBytes } from '@/lib/ui/format';
import { HardDrive } from 'lucide-react';

/**
 * "Physical instrument" gauge: half-arc with tick marks and a needle,
 * evocative of a real capacity dial rather than a flat progress bar.
 */
export function DiskGauge({ usedPercent, freeBytes, totalBytes, path }: { usedPercent: number; freeBytes: number; totalBytes: number; path: string }) {
  const pct = Math.max(0, Math.min(100, usedPercent));
  // needle rotation from -90deg (0%) to +90deg (100%)
  const angle = -90 + (pct / 100) * 180;
  const zone: 'ok' | 'warn' | 'crit' = pct < 70 ? 'ok' : pct < 90 ? 'warn' : 'crit';
  const needleColor = zone === 'ok' ? '#59D48B' : zone === 'warn' ? '#F2B94D' : '#F2665E';

  const ticks = Array.from({ length: 11 }); // 0, 10, ..., 100

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-32 w-56">
        <svg viewBox="0 0 200 110" className="h-full w-full">
          {/* outer arc */}
          <path d="M 20 100 A 80 80 0 0 1 180 100" stroke="#262D38" strokeWidth="10" fill="none" strokeLinecap="round" />
          {/* used arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            stroke={needleColor}
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 251.3} 999`}
            style={{ transition: 'stroke-dasharray 0.6s ease-out, stroke 0.3s' }}
          />
          {/* tick marks */}
          {ticks.map((_, i) => {
            const t = i / 10;
            const a = Math.PI * (1 - t);
            const r1 = 84;
            const r2 = i % 5 === 0 ? 72 : 78;
            const x1 = 100 + Math.cos(a) * r1;
            const y1 = 100 - Math.sin(a) * r1;
            const x2 = 100 + Math.cos(a) * r2;
            const y2 = 100 - Math.sin(a) * r2;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#5A6472" strokeWidth={i % 5 === 0 ? 1.5 : 1} />;
          })}
          {/* labels */}
          <text x="20" y="108" textAnchor="middle" className="fill-fg-faint font-mono" fontSize="8">0</text>
          <text x="100" y="20" textAnchor="middle" className="fill-fg-faint font-mono" fontSize="8">50</text>
          <text x="180" y="108" textAnchor="middle" className="fill-fg-faint font-mono" fontSize="8">100</text>
          {/* pivot */}
          <circle cx="100" cy="100" r="6" fill="#20262F" stroke="#5A6472" strokeWidth="1" />
          {/* needle */}
          <g transform={`rotate(${angle} 100 100)`} style={{ transition: 'transform 0.6s ease-out' }}>
            <line x1="100" y1="100" x2="100" y2="30" stroke={needleColor} strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="100" cy="30" r="2.5" fill={needleColor} />
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 text-center">
          <div className="font-mono text-2xl font-semibold" style={{ color: needleColor }}>{pct.toFixed(0)}%</div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-fg-muted">
        <HardDrive className="h-3.5 w-3.5" />
        <span>{formatBytes(freeBytes)} free / {formatBytes(totalBytes)}</span>
      </div>
      <div className="max-w-full truncate font-mono text-[10px] text-fg-faint" title={path}>{path}</div>
    </div>
  );
}
