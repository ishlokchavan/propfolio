'use client'

import { useState } from 'react'
import { Property } from '@/lib/types'
import { formatAED, formatMoney, paymentProgress, daysUntil, daysLabel, getUrgencyClass, developerColor, resaleStatus } from '@/lib/utils'
import { useCountUp } from '@/lib/animations'
import PropertyDetail from './PropertyDetail'

interface Props {
  properties: Property[]
  hasAccounts: boolean
  onConnectClick: () => void
  currency: { primary: string; secondary: string }
  rates: Record<string, number>
}

export default function PortfolioTab({ properties, hasAccounts, onConnectClick, currency, rates }: Props) {
  const [detail, setDetail] = useState<Property | null>(null)

  if (detail) {
    return <PropertyDetail property={detail} onBack={() => setDetail(null)} currency={currency} rates={rates} />
  }

  const totalValue = properties.reduce((s, p) => s + p.total_value, 0)
  const totalPaid = properties.reduce((s, p) => s + p.paid_amount, 0)
  const totalOutstanding = totalValue - totalPaid

  const allMilestones = properties.flatMap(p =>
    (p.payment_milestones || []).map(m => ({ ...m, property: p }))
  )
  const nextDue = allMilestones
    .filter(m => m.status === 'due' && m.due_date)
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())[0]

  return (
    <div className="h-full overflow-y-auto scroll-smooth anim-tab">
      {/* Header */}
      <div
        className="px-5 pt-safe pb-2"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 16px), 20px)' }}
      >
        <p className="text-[11px] font-semibold tracking-widest uppercase mb-1" style={{ color: 'var(--accent2)' }}>
          Propfolio
        </p>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--text)', fontFamily: 'system-ui' }}>
          Portfolio
        </h1>
      </div>

      {properties.length === 0 ? (
        <EmptyState hasAccounts={hasAccounts} onConnectClick={onConnectClick} />
      ) : (
        <>
          {/* Hero card */}
          <div className="mx-4 mt-3 rounded-2xl p-5 relative overflow-hidden anim-in"
            style={{
              background: 'var(--hero-bg)',
              border: '1px solid rgba(124,111,237,0.2)',
            }}
          >
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-30"
              style={{ background: 'radial-gradient(circle, #7C6FED 0%, transparent 70%)' }} />
            <p className="text-[11px] font-semibold tracking-wider uppercase mb-2" style={{ color: 'var(--text3)' }}>
              Total Portfolio Value
            </p>
            <HeroValue amount={totalValue} currency={currency.primary} rates={rates} />
            {currency.secondary !== 'none' && formatMoney(totalValue, currency.secondary, rates) && (
              <p className="text-[15px] font-medium mb-3" style={{ color: 'var(--text3)' }}>
                ≈ {formatMoney(totalValue, currency.secondary, rates)}
              </p>
            )}
            <div className="flex gap-5 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <Stat label="Paid" value={formatAED(totalPaid, true)} color="#10B981" />
              <Stat label="Outstanding" value={formatAED(totalOutstanding, true)} color="#F59E0B" />
              <Stat label="Properties" value={String(properties.length)} />
            </div>
          </div>

          {/* Due payment alert */}
          <DueAlert properties={properties} currency={currency} rates={rates} onSelect={setDetail} />

          {/* Resale eligibility strip */}
          <ResaleStrip properties={properties} onSelect={setDetail} />


          {/* Next due */}
          {nextDue && (
            <div className="mx-4 mt-3">
              <SectionHeader title="Next Payment Due" />
              <NextPaymentCard milestone={nextDue} onClick={() => setDetail(nextDue.property)} />
            </div>
          )}

          {/* Properties */}
          <div className="mx-4 mt-4 mb-6">
            <SectionHeader title="Properties" right={`${properties.length} total`} />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {properties.map((p, i) => (
                <div key={p.id} className={`anim-in-${Math.min(i, 3)}`}>
                  <PropertyCard property={p} onClick={() => setDetail(p)} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function EmptyState({ hasAccounts, onConnectClick }: { hasAccounts: boolean; onConnectClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-8 py-20 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 anim-float"
        style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4A4960" strokeWidth="1.5" strokeLinecap="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
      <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text2)' }}>No properties yet</h2>
      <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--text4)' }}>
        {hasAccounts
          ? 'Your email is connected. We\'re scanning for properties — check back shortly.'
          : 'Connect your email and we\'ll automatically find all your developer communications and build your portfolio.'}
      </p>
      {!hasAccounts && (
        <button
          onClick={onConnectClick}
          className="py-4 px-8 rounded-2xl font-semibold text-base active:scale-95 transition-all"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white' }}
        >
          Connect Email →
        </button>
      )}
    </div>
  )
}

function PropertyCard({ property: p, onClick }: { property: Property; onClick: () => void }) {
  const progress = paymentProgress(p.paid_amount, p.total_value)
  const nextMilestone = (p.payment_milestones || [])
    .filter(m => m.status === 'due' && m.due_date)
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())[0]
  const colorClass = developerColor(p.developer)
  const resale = resaleStatus(p.paid_amount, p.total_value, p.noc_threshold)

  return (
    <button
      onClick={onClick}
      className="w-full h-full text-left rounded-[20px] p-5 card-interactive"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
    >
      {/* Identity row */}
      <div className="flex items-start gap-3 mb-4">
        <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${colorClass} flex items-center justify-center flex-shrink-0`}>
          <span className="text-white font-bold text-[15px]">{p.developer[0]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[16px] leading-snug truncate" style={{ color: 'var(--text)', fontFamily: 'system-ui' }}>
            {p.project_name}
          </h3>
          <p className="text-[12px] mt-0.5 truncate" style={{ color: 'var(--text4)' }}>
            {p.developer} · {p.location || p.emirate}{p.property_type ? ` · ${p.property_type}` : ''}
          </p>
        </div>
        {resale?.eligible && (
          <span className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 mt-0.5"
            style={{ background: 'color-mix(in srgb, var(--green) 14%, transparent)', color: 'var(--green)' }}>
            Resale ✓
          </span>
        )}
      </div>

      {/* Value + progress */}
      <div className="flex items-baseline justify-between mb-1.5">
        <p className="text-[22px] font-bold" style={{ color: 'var(--text)', fontFamily: 'system-ui' }}>
          {formatAED(p.total_value, true)}
        </p>
        <p className="text-[12px] font-bold" style={{ color: 'var(--accent2)' }}>{progress}% paid</p>
      </div>
      <div className="h-[5px] rounded-full mb-4" style={{ background: 'var(--track)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${progress}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent2))' }} />
      </div>

      {/* Footer chips */}
      <div className="flex gap-2">
        {nextMilestone ? (
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl min-w-0"
            style={{ background: 'color-mix(in srgb, var(--gold) 9%, transparent)' }}>
            <svg width="13" height="13" className="flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <div className="min-w-0">
              <p className="text-[12px] font-bold truncate" style={{ color: 'var(--gold)' }}>
                {formatAED(nextMilestone.amount, true)}
              </p>
              <p className="text-[10px] truncate" style={{ color: 'var(--text4)' }}>
                due {new Date(nextMilestone.due_date!).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 px-3 py-2 rounded-xl" style={{ background: 'var(--surface2)' }}>
            <p className="text-[12px] font-bold" style={{ color: 'var(--text3)' }}>No payment due</p>
            <p className="text-[10px]" style={{ color: 'var(--text4)' }}>all caught up</p>
          </div>
        )}
        <div className="flex-1 px-3 py-2 rounded-xl min-w-0" style={{ background: 'var(--surface2)' }}>
          <p className="text-[12px] font-bold truncate" style={{ color: 'var(--text2)' }}>{p.handover_date || 'TBD'}</p>
          <p className="text-[10px]" style={{ color: 'var(--text4)' }}>handover</p>
        </div>
      </div>
    </button>
  )
}

function NextPaymentCard({ milestone, onClick }: { milestone: any; onClick: () => void }) {
  const days = milestone.due_date ? daysUntil(milestone.due_date) : null
  const urgency = days !== null ? getUrgencyClass(days) : 'future'
  const urgencyColor = urgency === 'overdue' ? 'var(--red)' : urgency === 'urgent' ? 'var(--gold)' : 'var(--accent2)'
  const date = milestone.due_date ? new Date(milestone.due_date) : null

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 rounded-2xl text-left active:scale-98 transition-all"
      style={{ background: 'var(--surface)', border: `1px solid ${urgencyColor}30` }}
    >
      <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
        style={{ background: `${urgencyColor}15`, border: `1px solid ${urgencyColor}30` }}>
        <span className="text-lg font-bold leading-none" style={{ color: urgencyColor }}>
          {date ? date.getDate() : '—'}
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: urgencyColor, opacity: 0.7 }}>
          {date ? date.toLocaleDateString('en-AE', { month: 'short' }) : ''}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[14px] truncate" style={{ color: 'var(--text)' }}>
          {milestone.property.project_name}
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>{milestone.label}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="font-bold text-[15px] font-mono" style={{ color: urgencyColor }}>
          {formatAED(milestone.amount, true)}
        </p>
        {days !== null && (
          <p className="text-[11px] mt-0.5" style={{ color: urgencyColor, opacity: 0.7 }}>
            {daysLabel(days)}
          </p>
        )}
      </div>
    </button>
  )
}

function SectionHeader({ title, right }: { title: string; right?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-[12px] font-semibold tracking-wider uppercase" style={{ color: 'var(--text3)' }}>{title}</p>
      {right && <p className="text-[12px]" style={{ color: 'var(--accent2)' }}>{right}</p>}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text4)' }}>{label}</p>
      <p className="text-[15px] font-semibold" style={{ color: color || 'var(--text)' }}>{value}</p>
    </div>
  )
}

function MiniStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex-1">
      <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text4)' }}>{label}</p>
      <p className="text-[13px] font-semibold" style={{ color: highlight ? 'var(--gold)' : 'var(--text)' }}>{value}</p>
    </div>
  )
}

function ResaleStrip({ properties, onSelect }: { properties: Property[]; onSelect: (p: Property) => void }) {
  const eligible = properties.filter(p => resaleStatus(p.paid_amount, p.total_value, p.noc_threshold)?.eligible)
  if (eligible.length === 0) return null

  return (
    <div className="mx-4 mt-3 p-4 rounded-2xl"
      style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
      <div className="flex items-center gap-2 mb-2.5">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--green)' }}>
          {eligible.length} {eligible.length === 1 ? 'property' : 'properties'} resale-eligible
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {eligible.map(p => (
          <button key={p.id} onClick={() => onSelect(p)}
            className="text-[12px] font-semibold px-3 py-1.5 rounded-full active:scale-95 transition-all"
            style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--green2)', border: '1px solid rgba(16,185,129,0.25)' }}>
            {p.project_name}
          </button>
        ))}
      </div>
      <p className="text-[11px] mt-2.5" style={{ color: 'var(--text4)' }}>
        Paid % has crossed the developer&apos;s NOC threshold — these units can be resold now.
      </p>
    </div>
  )
}

function DueAlert({ properties, currency, rates, onSelect }: { properties: Property[]; currency: { primary: string; secondary: string }; rates: Record<string, number>; onSelect: (p: Property) => void }) {
  const urgent = properties.flatMap(p =>
    (p.payment_milestones || [])
      .filter(m => m.status === 'due' && m.due_date && daysUntil(m.due_date) <= 14)
      .map(m => ({ m, p, days: daysUntil(m.due_date!) }))
  ).sort((a, b) => a.days - b.days)

  if (urgent.length === 0) return null
  const total = urgent.reduce((s, u) => s + u.m.amount, 0)

  return (
    <button
      onClick={() => onSelect(urgent[0].p)}
      className="w-full text-left mx-4 mt-3 p-4 rounded-2xl tap pulse-urgent"
      style={{ width: 'calc(100% - 32px)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)' }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--gold)' }}>
          {urgent.length} payment{urgent.length > 1 ? 's' : ''} due within 14 days
        </p>
      </div>
      <p className="text-[13px]" style={{ color: 'var(--gold2)' }}>
        {urgent[0].p.project_name} — {formatMoney(urgent[0].m.amount, currency.primary, rates)} {urgent[0].days <= 0 ? 'due today' : `in ${urgent[0].days}d`}
        {urgent.length > 1 ? ` · ${formatMoney(total, currency.primary, rates)} total` : ''}
      </p>
    </button>
  )
}

function HeroValue({ amount, currency, rates }: { amount: number; currency: string; rates: Record<string, number> }) {
  const animated = useCountUp(amount)
  return (
    <p className="text-4xl font-bold mb-1" style={{ color: 'var(--text)', fontFamily: 'system-ui' }}>
      {formatMoney(animated, currency, rates)}
    </p>
  )
}
