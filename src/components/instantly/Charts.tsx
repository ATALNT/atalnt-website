// ============================================
// Main-page charts. Two questions, two charts:
//   1. Are interested leads coming in, and is that tracking with volume?
//   2. Which campaign is actually producing them?
// ============================================

import {
  ResponsiveContainer, ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Cell, LabelList,
} from 'recharts';
import type { InstantlyCampaignRow } from '@/types/dashboard';
import { fmt, Label, Panel, TOOLTIP_STYLE } from './primitives';

const GOLD = '#D4A853';
const TEAL = '#2DD4BF';

export function TrendChart({ data }: { data: { date: string; sent: number; replies: number; interested: number }[] }) {
  const totalInt = data.reduce((s, x) => s + x.interested, 0);
  const totalRep = data.reduce((s, x) => s + x.replies, 0);
  return (
    <Panel className="p-4">
      <div className="flex items-baseline justify-between">
        <Label>Interested leads vs volume, last 14 days</Label>
        <span className="text-[11px] text-white/40">{fmt.int(totalInt)} interested · {fmt.int(totalRep)} replies</span>
      </div>
      <div className="h-[240px] mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -14 }} barCategoryGap="25%">
            <defs>
              <linearGradient id="sentFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GOLD} stopOpacity={0.35} />
                <stop offset="100%" stopColor={GOLD} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#7a7a8a', fontSize: 10 }} tickFormatter={(d) => d.slice(5).replace('-', '/')} axisLine={false} tickLine={false} />
            <YAxis yAxisId="vol" tick={{ fill: '#7a7a8a', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
            <YAxis yAxisId="ppl" orientation="right" allowDecimals={false} tick={{ fill: TEAL, fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: number, n: string) => [fmt.int(v), n]} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9a9aaa' }} iconType="circle" iconSize={8} />
            <Area yAxisId="vol" type="monotone" dataKey="sent" name="Sent" stroke={GOLD} strokeWidth={1.5} fill="url(#sentFill)" isAnimationActive={false} />
            <Bar yAxisId="ppl" dataKey="replies" name="Replies" fill="rgba(255,255,255,0.18)" radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            <Bar yAxisId="ppl" dataKey="interested" name="Interested" fill={TEAL} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false}>
              <LabelList dataKey="interested" position="top" formatter={(v: number) => (v > 0 ? v : '')} style={{ fill: TEAL, fontSize: 11, fontWeight: 700 }} />
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 text-[10px] text-white/30">Gold area is send volume (left axis). Bars are people (right axis): grey replied, turquoise said yes.</div>
    </Panel>
  );
}

export function CampaignCompare({ rows }: { rows: InstantlyCampaignRow[] }) {
  const data = rows
    .filter((r) => r.sent > 0)
    .map((r) => ({
      name: r.name.replace(/^GMAIL:\s*/, '').replace(' - ATALNT AI', '').replace('ATALNT AI - ', ''),
      interested: r.interested,
      reply_pct: +(r.reply_rate * 100).toFixed(2),
      int_per_k: r.sent ? +((r.interested / r.sent) * 1000).toFixed(2) : 0,
      sent: r.sent,
    }))
    .sort((a, b) => b.int_per_k - a.int_per_k);
  const max = Math.max(0.01, ...data.map((d) => d.int_per_k));
  return (
    <Panel className="p-4">
      <div className="flex items-baseline justify-between">
        <Label>Interested per 1,000 sends, by campaign</Label>
        <span className="text-[11px] text-white/40">the fairest way to compare campaigns of different sizes</span>
      </div>
      <div className="mt-3" style={{ height: Math.max(160, data.length * 44) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 8 }} barCategoryGap="30%">
            <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
            <XAxis type="number" domain={[0, Math.ceil(max * 1.15 * 10) / 10]} tickFormatter={(v: number) => v.toFixed(1)} tick={{ fill: '#7a7a8a', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={170} tick={{ fill: '#c8c8d2', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(v: number, n: string, p) => {
                const d = p.payload as { interested: number; sent: number; reply_pct: number };
                if (n === 'int_per_k') return [`${v} per 1k · ${d.interested} people from ${fmt.int(d.sent)} sends · ${d.reply_pct}% reply`, 'Interested'];
                return [v, n];
              }}
            />
            <Bar dataKey="int_per_k" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
              {data.map((d, i) => <Cell key={i} fill={d.interested > 0 ? TEAL : 'rgba(255,255,255,0.12)'} />)}
              <LabelList dataKey="interested" position="right" formatter={(v: number) => (v > 0 ? `${v} interested` : 'none yet')} style={{ fill: '#9a9aaa', fontSize: 10 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
