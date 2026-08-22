// ============================================
// Shared primitives for the Instantly Command Center.
// Matches the house style: #0a0b0f canvas, gold #D4A853 accent, glass surfaces.
// ============================================

import type { ReactNode } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

export const fmt = {
  int: (n: number) => (n ?? 0).toLocaleString(),
  pct: (r: number, d = 2) => `${((r ?? 0) * 100).toFixed(d)}%`,
  time: (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  },
  ago: (iso?: string | null) => {
    if (!iso) return '';
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  },
};

export const LIGHT: Record<'green' | 'yellow' | 'red', string> = {
  green: 'bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.65)]',
  yellow: 'bg-yellow-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]',
  red: 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]',
};

export function StatusLight({ light, title }: { light: 'green' | 'yellow' | 'red'; title?: string }) {
  return <span title={title} className={`inline-block h-2.5 w-2.5 rounded-full ${LIGHT[light]}`} />;
}

export function Panel({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl bg-white/[0.03] border border-white/[0.06] ${onClick ? 'cursor-pointer hover:bg-[#2DD4BF]/[0.04] hover:border-[#2DD4BF]/40 transition-colors' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="text-[11px] uppercase tracking-widest text-[#8a8a9a]">{children}</div>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-bold uppercase tracking-widest text-white flex items-center gap-2"><span className="inline-block h-3 w-1 rounded-full bg-[#2DD4BF]" />{children}</h2>
      {right}
    </div>
  );
}

export function Tile({
  label, value, sub, tone = 'neutral', onClick, icon,
}: {
  label: string; value: string; sub?: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'gold'; onClick?: () => void; icon?: ReactNode;
}) {
  const valueTone = { neutral: 'text-white', good: 'text-[#2DD4BF]', warn: 'text-yellow-400', bad: 'text-red-400', gold: 'text-[#D4A853]' }[tone];
  return (
    <Panel onClick={onClick} className="p-5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {icon && <span className="text-white/30">{icon}</span>}
      </div>
      <div className={`mt-2 text-3xl font-bold font-display leading-none ${valueTone}`}>{value}</div>
      {sub && <div className="mt-2 text-[11px] text-white/40">{sub}</div>}
    </Panel>
  );
}

export function Sparkline({ data, color = '#D4A853' }: { data: { date: string; sent: number; replies: number }[]; color?: string }) {
  if (!data?.length) return <div className="h-8 w-28" />;
  return (
    <div className="h-8 w-28">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line type="monotone" dataKey="sent" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: '#1a1b23', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#D4A853', fontWeight: 700 },
  itemStyle: { color: '#e5e7eb' },
} as const;

export const CLASS_META: Record<string, { label: string; cls: string }> = {
  demo: { label: 'Demo requested', cls: 'bg-[#D4A853]/15 text-[#D4A853] border-[#D4A853]/30' },
  positive: { label: 'Positive', cls: 'bg-teal-400/10 text-teal-300 border-teal-400/30' },
  neutral: { label: 'Neutral', cls: 'bg-white/[0.04] text-white/60 border-white/10' },
  negative: { label: 'Not interested', cls: 'bg-red-400/10 text-red-300 border-red-400/30' },
  wrong_person: { label: 'Wrong person', cls: 'bg-yellow-400/10 text-yellow-300 border-yellow-400/30' },
  auto: { label: 'Auto-reply', cls: 'bg-white/[0.03] text-white/30 border-white/5' },
};

export function ClassPill({ cls }: { cls: string }) {
  const m = CLASS_META[cls] || CLASS_META.neutral;
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${m.cls}`}>{m.label}</span>;
}
