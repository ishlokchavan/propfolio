'use client'

import { Property, PaymentMilestone } from '@/lib/types'
import { formatAED, daysUntil, daysLabel } from '@/lib/utils'

interface Props { properties: Property[] }

interface MilestoneWithProperty extends PaymentMilestone {
  property: Property
}

export default function PaymentsTab({ properties }: Props) {
  const all: MilestoneWithProperty[] = properties.flatMap(p =>
    (p.payment_milestones || []).map(m => ({ ...m, property: p }))
  )

  const paid = all.filter(m => m.status === 'paid')
  const due = all.filter(m => m.status === 'due').sort((a, b) => {
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  })
  const future = all.filter(m => m.status === 'future').sort((a, b) => {
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  })

  const totalDue = due.reduce((s, m) => s + m.amount, 0)
  const totalFuture = future.reduce((s, m) => s + m.amount, 0)

  return (
    <div className="h-full overflow-y-auto scroll-smooth">
      <div className="px-5" style={{ paddingTop: 'max(env(safe-area-inset-top, 16px), 20px)' }}>
        <p className="text-[11px] font-semibold tracking-widest uppercase mb-1" style={{ color: 'var(--accent2)' }}>Payments</p>
        <h1 className="text-3xl font-bold mb-4" style={{ color: 'var(--text)', fontFamily: 'system-ui' }}>Schedule</h1>
      </div>

      {all.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4A4960" strokeWidth="1.5" className="mb-4 opacity-50" strokeLinecap="round">
            <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
          </svg>
          <p className="text-lg font-semibold mb-2" style={{ color: 'var(--text3)' }}>No payments yet</p>
          <p className="text-sm" style={{ color: 'var(--text4)' }}>Connect your email to see your payment schedule.</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-2.5 mx-4 mb-4">
            <div className="p-4 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text4)' }}>Due Soon</p>
              <p className="text-xl font-bold" style={{ color: 'var(--gold)', fontFamily: 'system-ui' }}>{formatAED(totalDue, true)}</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>{due.length} payment{due.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="p-4 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid rgba(124,111,237,0.2)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text4)' }}>Outstanding</p>
              <p className="text-xl font-bold" style={{ color: 'var(--accent2)', fontFamily: 'system-ui' }}>{formatAED(totalFuture, true)}</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>{future.length} upcoming</p>
            </div>
          </div>

          {/* Due */}
          {due.length > 0 && (
            <Section title="Due Now" color="#F59E0B">
              {due.map(m => <MilestoneRow key={m.id} milestone={m} type="due" />)}
            </Section>
          )}

          {/* Upcoming */}
          {future.length > 0 && (
            <Section title="Upcoming">
              {future.slice(0, 10).map(m => <MilestoneRow key={m.id} milestone={m} type="future" />)}
            </Section>
          )}

          {/* Paid */}
          {paid.length > 0 && (
            <Section title={`Paid (${paid.length})`}>
              {paid.slice(0, 5).map(m => <MilestoneRow key={m.id} milestone={m} type="paid" />)}
            </Section>
          )}

          <div className="h-6" />
        </>
      )}
    </div>
  )
}

function Section({ title, color, children }: { title: string; color?: string; children: React.ReactNode }) {
  return (
    <div className="mx-4 mb-4">
      <p className="text-[12px] font-semibold tracking-wider uppercase mb-2"
        style={{ color: color || 'var(--text3)' }}>{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function MilestoneRow({ milestone: m, type }: { milestone: MilestoneWithProperty; type: 'paid' | 'due' | 'future' }) {
  const color = type === 'paid' ? 'var(--green)' : type === 'due' ? 'var(--gold)' : 'var(--text3)'
  const days = m.due_date ? daysUntil(m.due_date) : null
  const date = m.due_date
    ? new Date(m.due_date).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })
    : (m.due_label || '—')

  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {/* Date block */}
      <div className="w-11 h-11 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
        style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
        {type === 'paid' ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        ) : (
          <>
            <span className="text-base font-bold leading-none" style={{ color }}>
              {m.due_date ? new Date(m.due_date).getDate() : '—'}
            </span>
            <span className="text-[9px] uppercase font-semibold tracking-wide mt-0.5" style={{ color, opacity: 0.7 }}>
              {m.due_date ? new Date(m.due_date).toLocaleDateString('en-AE', { month: 'short' }) : ''}
            </span>
          </>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold truncate" style={{ color: type === 'future' ? 'var(--text2)' : 'var(--text)' }}>
          {m.property.project_name}
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text4)' }}>
          {m.label}{type !== 'paid' && days !== null ? ` · ${daysLabel(days)}` : ''}
        </p>
      </div>

      <p className="font-bold text-[14px] flex-shrink-0" style={{ color, fontFamily: 'system-ui' }}>
        {formatAED(m.amount, true)}
      </p>
    </div>
  )
}
