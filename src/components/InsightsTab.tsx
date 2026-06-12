'use client'

import { useState, useMemo } from 'react'
import { Property } from '@/lib/types'
import { formatMoney, cashflowBuckets, CashflowGranularity, monthsUntilHandover, paymentProgress } from '@/lib/utils'

interface Props {
  properties: Property[]
  currency: { primary: string; secondary: string }
  rates: Record<string, number>
}

const DONUT_COLORS = ['#7C6FED', '#10B981', '#F59E0B', '#06B6D4', '#EF4444', '#A78BFA', '#EC4899']

export default function InsightsTab({ properties, currency, rates }: Props) {
  if (properties.length === 0) {
    return (
      <div className="h-full overflow-y-auto scroll-smooth">
        <Header />
        <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
          <p className="text-lg font-semibold mb-2" style={{ color: 'var(--text3)' }}>No data yet</p>
          <p className="text-sm" style={{ color: 'var(--text4)' }}>Insights appear once your portfolio has properties.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto scroll-smooth">
      <Header />
      <div className="lg:grid lg:grid-cols-2 lg:gap-3 lg:mx-4 lg:items-start">
        <div>
          <CashflowCard properties={properties} currency={currency} rates={rates} />
          <EquityCard properties={properties} currency={currency} rates={rates} />
        </div>
        <div>
          <CompositionCard properties={properties} currency={currency} rates={rates} />
          <HandoverCard properties={properties} />
        </div>
      </div>
      <div className="h-8" />
    </div>
  )
}

function Header() {
  return (
    <div className="px-5" style={{ paddingTop: 'max(env(safe-area-inset-top, 16px), 20px)' }}>
      <p className="text-[11px] font-semibold tracking-widest uppercase mb-1" style={{ color: 'var(--accent2)' }}>Insights</p>
      <h1 className="text-3xl font-bold mb-4" style={{ color: 'var(--text)', fontFamily: 'system-ui' }}>Your Money</h1>
    </div>
  )
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="mx-4 lg:mx-0 mb-3 p-4 rounded-2xl anim-in" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>{title}</p>
      {sub && <p className="text-[12px] mt-0.5 mb-3" style={{ color: 'var(--text4)' }}>{sub}</p>}
      {!sub && <div className="h-3" />}
      {children}
    </div>
  )
}

// ── 1. Cashflow with Month / Quarter / Year granularity ──
function CashflowCard({ properties, currency, rates }: Props) {
  const [gran, setGran] = useState<CashflowGranularity>('quarter')
  const all = properties.flatMap(p => p.payment_milestones || [])
  const buckets = useMemo(() => cashflowBuckets(all, gran).slice(0, gran === 'month' ? 12 : gran === 'quarter' ? 8 : 6), [all, gran])
  const max = Math.max(...buckets.map(b => b.total), 1)
  const total = buckets.reduce((s, b) => s + b.total, 0)

  return (
    <Card title="Upcoming Cashflow" sub="How much you need, and when">
      <div className="flex gap-1.5 mb-4 p-1 rounded-xl" style={{ background: 'var(--surface2)' }}>
        {(['month', 'quarter', 'year'] as CashflowGranularity[]).map(g => (
          <button key={g} onClick={() => setGran(g)}
            className="flex-1 py-1.5 rounded-lg text-[12px] font-bold capitalize transition-all"
            style={gran === g
              ? { background: 'var(--surface)', color: 'var(--text)', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }
              : { color: 'var(--text4)' }}>
            {g}
          </button>
        ))}
      </div>
      <div className="space-y-2.5">
        {buckets.map(b => (
          <div key={b.label} className="flex items-center gap-3">
            <span className="text-[11px] font-bold w-14 flex-shrink-0" style={{ color: 'var(--text3)' }}>{b.label}</span>
            <div className="flex-1 h-[18px] rounded-md overflow-hidden" style={{ background: 'var(--track)' }}>
              <div className="h-full rounded-md transition-all duration-500"
                style={{ width: `${Math.max(3, (b.total / max) * 100)}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent2))' }} />
            </div>
            <span className="text-[12px] font-bold w-[72px] text-right flex-shrink-0" style={{ color: 'var(--text)', fontFamily: 'system-ui' }}>
              {formatMoney(b.total, currency.primary, rates)}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px] mt-3.5 pt-3" style={{ color: 'var(--text4)', borderTop: '1px solid var(--border)' }}>
        Total shown: {formatMoney(total, currency.primary, rates)}
        {currency.secondary !== 'none' && formatMoney(total, currency.secondary, rates) && ` ≈ ${formatMoney(total, currency.secondary, rates)}`}
      </p>
    </Card>
  )
}

// ── 2. Portfolio composition donut ──
function CompositionCard({ properties, currency, rates }: Props) {
  const byDev = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of properties) map.set(p.developer, (map.get(p.developer) || 0) + p.total_value)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [properties])
  const total = byDev.reduce((s, [, v]) => s + v, 0)

  const R = 56, C = 2 * Math.PI * R
  let offset = 0
  const segments = byDev.map(([dev, value], i) => {
    const frac = value / total
    const seg = { dev, value, frac, dash: frac * C, offset, color: DONUT_COLORS[i % DONUT_COLORS.length] }
    offset += frac * C
    return seg
  })

  return (
    <Card title="Portfolio Mix" sub="Value split across developers">
      <div className="flex items-center gap-5">
        <div className="relative flex-shrink-0">
          <svg width="136" height="136" viewBox="0 0 136 136">
            <circle cx="68" cy="68" r={R} fill="none" stroke="var(--track)" strokeWidth="16" />
            {segments.map(s => (
              <circle key={s.dev} cx="68" cy="68" r={R} fill="none" stroke={s.color} strokeWidth="16"
                strokeDasharray={`${s.dash} ${C - s.dash}`} strokeDashoffset={-s.offset}
                transform="rotate(-90 68 68)" strokeLinecap="butt" />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text4)' }}>Total</span>
            <span className="text-[15px] font-bold" style={{ color: 'var(--text)', fontFamily: 'system-ui' }}>
              {formatMoney(total, currency.primary, rates)}
            </span>
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          {segments.map(s => (
            <div key={s.dev} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
              <span className="text-[12px] font-semibold truncate flex-1" style={{ color: 'var(--text2)' }}>{s.dev}</span>
              <span className="text-[12px] font-bold flex-shrink-0" style={{ color: 'var(--text)' }}>{Math.round(s.frac * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

// ── 3. Equity progress per property ──
function EquityCard({ properties, currency, rates }: Props) {
  const totalPaid = properties.reduce((s, p) => s + p.paid_amount, 0)
  return (
    <Card title="Equity Built" sub={`${formatMoney(totalPaid, currency.primary, rates)} of your money is in — per property:`}>
      <div className="space-y-3.5">
        {[...properties].sort((a, b) => paymentProgress(b.paid_amount, b.total_value) - paymentProgress(a.paid_amount, a.total_value)).map(p => {
          const pct = paymentProgress(p.paid_amount, p.total_value)
          return (
            <div key={p.id}>
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="text-[12px] font-semibold truncate pr-2" style={{ color: 'var(--text2)' }}>{p.project_name}</span>
                <span className="text-[12px] font-bold flex-shrink-0" style={{ color: 'var(--green)' }}>{pct}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden flex" style={{ background: 'var(--track)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--green), var(--green2))' }} />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ── 4. Handover timeline ──
function HandoverCard({ properties }: { properties: Property[] }) {
  const sorted = useMemo(() =>
    [...properties]
      .map(p => ({ p, months: monthsUntilHandover(p.handover_date) }))
      .sort((a, b) => (a.months ?? 999) - (b.months ?? 999)),
    [properties])

  return (
    <Card title="Handover Timeline" sub="When you get the keys">
      <div className="space-y-0">
        {sorted.map(({ p, months }, i) => (
          <div key={p.id} className="flex items-center gap-3.5 py-2.5"
            style={{ borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
              style={{
                background: months !== null && months <= 12 ? 'color-mix(in srgb, var(--green) 14%, transparent)' : 'var(--surface2)',
                color: months !== null && months <= 12 ? 'var(--green)' : 'var(--text3)',
              }}>
              {months !== null ? (months < 12 ? `${months}m` : `${(months / 12).toFixed(1)}y`) : '—'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--text)' }}>{p.project_name}</p>
              <p className="text-[11px]" style={{ color: 'var(--text4)' }}>{p.handover_date || 'TBD'}</p>
            </div>
            {months !== null && months <= 12 && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0"
                style={{ background: 'color-mix(in srgb, var(--green) 14%, transparent)', color: 'var(--green)' }}>
                Soon
              </span>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}
