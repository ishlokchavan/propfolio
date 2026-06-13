'use client'

import { useState, useMemo } from 'react'
import { Property, PaymentMilestone } from '@/lib/types'
import { formatAED, daysUntil } from '@/lib/utils'
import { useCountUp } from '@/lib/animations'

interface Props { properties: Property[] }

interface Item extends PaymentMilestone { property: Property; days: number | null }

type Bucket = 'overdue' | 'due' | 'upcoming' | 'scheduled' | 'paid'

const BUCKETS: Array<{ key: Bucket; label: string; desc: string; color: string }> = [
  { key: 'overdue', label: 'Overdue', desc: 'Past the due date — penalties may be accumulating', color: 'var(--red)' },
  { key: 'due', label: 'Due Now', desc: 'Payments due within the next 30 days', color: 'var(--gold)' },
  { key: 'upcoming', label: 'Upcoming', desc: 'Due in 31–90 days — start planning liquidity', color: 'var(--accent2)' },
  { key: 'scheduled', label: 'Scheduled', desc: 'More than 90 days away, or milestone-linked', color: 'var(--text3)' },
  { key: 'paid', label: 'Paid', desc: 'Completed payments across your portfolio', color: 'var(--green)' },
]

function classify(m: Item): Bucket {
  if (m.status === 'paid') return 'paid'
  if (m.days === null) return 'scheduled'
  if (m.days < 0) return 'overdue'
  if (m.days <= 30) return 'due'
  if (m.days <= 90) return 'upcoming'
  return 'scheduled'
}

export default function PaymentsTab({ properties }: Props) {
  const items: Item[] = useMemo(() => properties.flatMap(p =>
    (p.payment_milestones || []).map(m => ({
      ...m, property: p, days: m.due_date ? daysUntil(m.due_date) : null,
    }))
  ), [properties])

  const grouped = useMemo(() => {
    const g: Record<Bucket, Item[]> = { overdue: [], due: [], upcoming: [], scheduled: [], paid: [] }
    for (const it of items) g[classify(it)].push(it)
    g.overdue.sort((a, b) => (a.days ?? 0) - (b.days ?? 0))
    g.due.sort((a, b) => (a.days ?? 99) - (b.days ?? 99))
    g.upcoming.sort((a, b) => (a.days ?? 99) - (b.days ?? 99))
    g.scheduled.sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999))
    const paidTime = (m: Item) => {
      const d = m.paid_date || m.due_date
      return d ? new Date(d).getTime() : 0
    }
    g.paid.sort((a, b) => paidTime(b) - paidTime(a)) // latest first
    return g
  }, [items])

  // Default to the most urgent non-empty bucket
  const firstNonEmpty = (BUCKETS.find(b => grouped[b.key].length > 0)?.key || 'due') as Bucket
  const [active, setActive] = useState<Bucket>(firstNonEmpty)

  const activeMeta = BUCKETS.find(b => b.key === active)!
  const activeItems = grouped[active]
  const activeTotal = activeItems.reduce((s, i) => s + Number(i.amount), 0)

  return (
    <div className="h-full overflow-y-auto scroll-smooth anim-tab">
      <div className="px-5" style={{ paddingTop: 'max(env(safe-area-inset-top, 16px), 20px)' }}>
        <p className="text-[11px] font-semibold tracking-widest uppercase mb-1" style={{ color: 'var(--accent2)' }}>Payments</p>
        <h1 className="text-3xl font-bold mb-4" style={{ color: 'var(--text)', fontFamily: 'system-ui' }}>Schedule</h1>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
          <p className="text-lg font-semibold mb-2" style={{ color: 'var(--text3)' }}>No payments yet</p>
          <p className="text-sm" style={{ color: 'var(--text4)' }}>Connect your email in Settings to build your schedule.</p>
        </div>
      ) : (
        <>
          {/* Segmented pills */}
          <div className="flex gap-2 px-4 pb-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {BUCKETS.map(b => {
              const count = grouped[b.key].length
              const isActive = active === b.key
              return (
                <button key={b.key} onClick={() => setActive(b.key)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[13px] font-bold whitespace-nowrap flex-shrink-0 tap"
                  style={isActive
                    ? { background: b.color, color: b.key === 'scheduled' ? 'var(--bg)' : 'white' }
                    : { background: 'var(--surface)', color: count ? 'var(--text2)' : 'var(--text4)', border: '1px solid var(--border)', opacity: count ? 1 : 0.55 }}>
                  {b.label}
                  {count > 0 && (
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                      style={isActive ? { background: 'rgba(255,255,255,0.25)' } : { background: 'var(--surface2)', color: 'var(--text3)' }}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Active bucket summary */}
          <div key={active} className="mx-4 mt-3 mb-3 p-4 rounded-2xl anim-pop" style={{ background: 'var(--surface)', border: `1px solid ${activeMeta.color}30` }}>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wider mb-1" style={{ color: activeMeta.color }}>{activeMeta.label}</p>
                <p className="text-[12px] leading-snug" style={{ color: 'var(--text4)' }}>{activeMeta.desc}</p>
              </div>
              <BucketTotal total={activeTotal} color={activeMeta.color} />
            </div>
          </div>

          {/* Items */}
          <div key={active} className="mx-4 space-y-2 pb-8">
            {activeItems.length === 0 ? (
              <p className="text-center text-[13px] py-10" style={{ color: 'var(--text4)' }}>
                Nothing in {activeMeta.label.toLowerCase()} — all clear here.
              </p>
            ) : activeItems.map((it, idx) => (
              <Row key={it.id} item={it} bucket={active} color={activeMeta.color} index={idx} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Row({ item: m, bucket, color, index }: { item: Item; bucket: Bucket; color: string; index: number }) {
  const date = m.due_date
    ? new Date(m.due_date).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })
    : (m.due_label || 'Milestone-linked')

  const meta =
    bucket === 'overdue' && m.days !== null ? `Overdue by ${Math.abs(m.days)}d` :
    bucket === 'due' && m.days !== null ? (m.days === 0 ? 'Due today' : `Due in ${m.days}d`) :
    bucket === 'upcoming' && m.days !== null ? `In ${Math.round(m.days / 7)} weeks` :
    bucket === 'paid' ? 'Paid' : date

  return (
    <div className={`flex items-center gap-3.5 p-4 rounded-2xl anim-in-${Math.min(index, 3)}`}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="w-11 h-11 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
        style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 28%, transparent)` }}>
        {bucket === 'paid' ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        ) : bucket === 'overdue' ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        ) : (
          <>
            <span className="text-[15px] font-bold leading-none" style={{ color }}>
              {m.due_date ? new Date(m.due_date).getDate() : '—'}
            </span>
            <span className="text-[9px] uppercase font-bold tracking-wide mt-0.5" style={{ color, opacity: 0.65 }}>
              {m.due_date ? new Date(m.due_date).toLocaleDateString('en-AE', { month: 'short' }) : ''}
            </span>
          </>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold truncate" style={{ color: 'var(--text)' }}>{m.property.project_name}</p>
        <p className="text-[12px] mt-0.5 truncate" style={{ color: 'var(--text4)' }}>{m.label} · {date}</p>
      </div>

      <div className="text-right flex-shrink-0">
        <p className="font-bold text-[15px]" style={{ color, fontFamily: 'system-ui' }}>{formatAED(Number(m.amount), true)}</p>
        <p className="text-[11px] mt-0.5 font-medium" style={{ color, opacity: 0.75 }}>{meta}</p>
      </div>
    </div>
  )
}

function BucketTotal({ total, color }: { total: number; color: string }) {
  const v = useCountUp(total, 700)
  return (
    <p className="text-xl font-bold flex-shrink-0" style={{ color, fontFamily: 'system-ui' }}>
      {formatAED(v, true)}
    </p>
  )
}
