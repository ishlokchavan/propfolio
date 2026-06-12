'use client'

import { Property } from '@/lib/types'
import { formatAED, formatMoney, paymentProgress, developerColor, resaleStatus } from '@/lib/utils'

interface Props {
  property: Property
  onBack: () => void
  currency: { primary: string; secondary: string }
  rates: Record<string, number>
}

export default function PropertyDetail({ property: p, onBack, currency, rates }: Props) {
  const progress = paymentProgress(p.paid_amount, p.total_value)
  const milestones = [...(p.payment_milestones || [])].sort((a, b) => {
    const order = { paid: 0, due: 1, future: 2 }
    return order[a.status] - order[b.status]
  })
  const colorClass = developerColor(p.developer)

  return (
    <div className="h-full overflow-y-auto scroll-smooth">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 12px), 16px)', borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 active:scale-90 transition-all"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9B9AB0" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h2 className="font-bold text-[17px] truncate" style={{ color: 'var(--text)', fontFamily: 'system-ui' }}>
          {p.project_name}
        </h2>
      </div>

      {/* Hero */}
      <div className="mx-4 mt-4 p-5 rounded-2xl relative overflow-hidden"
        style={{ background: 'var(--hero-bg)', border: '1px solid rgba(124,111,237,0.2)' }}>
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-25"
          style={{ background: 'radial-gradient(circle, #7C6FED, transparent 70%)' }} />
        <div className={`h-0.5 rounded-full bg-gradient-to-r ${colorClass} mb-3`} />
        <p className="text-[11px] font-semibold tracking-wider uppercase mb-2" style={{ color: 'var(--text4)' }}>
          {p.developer} · {p.location || p.emirate}
        </p>
        <p className="text-3xl font-bold mb-0.5" style={{ color: 'var(--text)', fontFamily: 'system-ui' }}>
          {formatMoney(p.total_value, currency.primary, rates)}
        </p>
        {currency.secondary !== 'none' && formatMoney(p.total_value, currency.secondary, rates) && (
          <p className="text-[14px] font-medium mb-3" style={{ color: 'var(--text3)' }}>
            ≈ {formatMoney(p.total_value, currency.secondary, rates)}
          </p>
        )}
        <div className="mb-3">
          <div className="flex justify-between text-[11px] mb-1.5">
            <span style={{ color: 'var(--text4)' }}>Payment progress</span>
            <span className="font-bold" style={{ color: 'var(--accent2)' }}>{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full" style={{ background: 'var(--track)' }}>
            <div className="h-full rounded-full" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent2))' }} />
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2.5 mx-4 mt-3">
        {[
          { label: 'Paid', value: formatAED(p.paid_amount, true), color: 'var(--green)' },
          { label: 'Remaining', value: formatAED(p.total_value - p.paid_amount, true), color: 'var(--gold)' },
          { label: 'Unit', value: p.unit_number || '—' },
          { label: 'Handover', value: p.handover_date || '—' },
        ].map(s => (
          <div key={s.label} className="p-3.5 rounded-xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text4)' }}>{s.label}</p>
            <p className="text-[17px] font-bold" style={{ color: s.color || 'var(--text)', fontFamily: 'system-ui' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Resale NOC card */}
      <ResaleCard property={p} />

      {/* Payment timeline */}
      <div className="mx-4 mt-4 mb-8">
        <p className="text-[12px] font-semibold tracking-wider uppercase mb-3" style={{ color: 'var(--text3)' }}>
          Payment Timeline
        </p>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-3 top-3 bottom-3 w-px" style={{ background: 'var(--border)' }} />

          <div className="space-y-0">
            {milestones.map((m, i) => {
              const statusColor = m.status === 'paid' ? 'var(--green)' : m.status === 'due' ? 'var(--gold)' : 'var(--text4)'
              const date = m.due_date ? new Date(m.due_date).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' }) : m.due_label

              return (
                <div key={m.id} className="flex gap-4 pb-5 relative">
                  {/* Dot */}
                  <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center z-10"
                    style={{ background: `${statusColor}20`, border: `1.5px solid ${statusColor}60` }}>
                    {m.status === 'paid' ? (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={statusColor} strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : m.status === 'due' ? (
                      <div className="w-2 h-2 rounded-full" style={{ background: statusColor }} />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
                    )}
                  </div>

                  <div className="flex-1 pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[13px] font-semibold" style={{ color: m.status === 'future' ? 'var(--text3)' : 'var(--text)' }}>
                          {m.label}
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text4)' }}>{date || '—'}</p>
                      </div>
                      <p className="text-[14px] font-bold flex-shrink-0" style={{ color: statusColor, fontFamily: 'system-ui' }}>
                        {formatAED(m.amount, true)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function ResaleCard({ property: p }: { property: Property }) {
  const rs = resaleStatus(p.paid_amount, p.total_value, p.noc_threshold)
  if (!rs) return null

  const color = rs.eligible ? 'var(--green)' : 'var(--gold)'
  const barPct = Math.min(100, (rs.paidPct / rs.threshold) * 100)

  return (
    <div className="mx-4 mt-3 p-4 rounded-2xl"
      style={{ background: `${color}08`, border: `1px solid ${color}30` }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color }}>
          Resale Eligibility
        </p>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: `${color}18`, color }}>
          {rs.eligible ? 'Eligible now' : 'Not yet'}
        </span>
      </div>

      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: 'var(--text4)' }}>Paid</p>
          <p className="text-xl font-bold" style={{ color, fontFamily: 'system-ui' }}>{rs.paidPct}%</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: 'var(--text4)' }}>NOC threshold</p>
          <p className="text-xl font-bold" style={{ color: 'var(--text2)', fontFamily: 'system-ui' }}>{rs.threshold}%</p>
        </div>
      </div>

      {/* Progress toward threshold */}
      <div className="h-2 rounded-full relative" style={{ background: 'var(--track)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${barPct}%`, background: `linear-gradient(90deg, ${color}90, ${color})` }} />
      </div>

      <p className="text-[12px] mt-3 leading-relaxed" style={{ color: rs.eligible ? 'var(--green2)' : 'var(--text2)' }}>
        {rs.eligible
          ? `This unit has crossed ${p.developer}'s ${rs.threshold}% NOC threshold — you can apply for a resale NOC and list it today.`
          : `Pay ${formatAED(rs.amountToEligibility, true)} more to cross ${p.developer}'s ${rs.threshold}% threshold and unlock resale.`}
      </p>
    </div>
  )
}
