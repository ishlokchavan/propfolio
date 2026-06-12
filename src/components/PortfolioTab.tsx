'use client'

import { useState } from 'react'
import { Property } from '@/lib/types'
import { formatAED, paymentProgress, daysUntil, daysLabel, getUrgencyClass, developerColor } from '@/lib/utils'
import PropertyDetail from './PropertyDetail'

interface Props {
  properties: Property[]
  hasAccounts: boolean
  onConnectClick: () => void
}

export default function PortfolioTab({ properties, hasAccounts, onConnectClick }: Props) {
  const [detail, setDetail] = useState<Property | null>(null)

  if (detail) {
    return <PropertyDetail property={detail} onBack={() => setDetail(null)} />
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
    <div className="h-full overflow-y-auto scroll-smooth">
      {/* Header */}
      <div
        className="px-5 pt-safe pb-2"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 16px), 20px)' }}
      >
        <p className="text-[11px] font-semibold tracking-widest uppercase mb-1" style={{ color: '#A78BFA' }}>
          Propfolio
        </p>
        <h1 className="text-3xl font-bold" style={{ color: '#F1F0FF', fontFamily: 'system-ui' }}>
          Portfolio
        </h1>
      </div>

      {properties.length === 0 ? (
        <EmptyState hasAccounts={hasAccounts} onConnectClick={onConnectClick} />
      ) : (
        <>
          {/* Hero card */}
          <div className="mx-4 mt-3 rounded-2xl p-5 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #1a1535 0%, #12122a 50%, #0d1a35 100%)',
              border: '1px solid rgba(124,111,237,0.2)',
            }}
          >
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-30"
              style={{ background: 'radial-gradient(circle, #7C6FED 0%, transparent 70%)' }} />
            <p className="text-[11px] font-semibold tracking-wider uppercase mb-2" style={{ color: '#6B6A7F' }}>
              Total Portfolio Value
            </p>
            <p className="text-4xl font-bold mb-4" style={{ color: '#F1F0FF', fontFamily: 'system-ui' }}>
              <span className="text-lg font-normal" style={{ color: '#9B9AB0' }}>AED </span>
              {(totalValue / 1_000_000).toFixed(2)}M
            </p>
            <div className="flex gap-5 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <Stat label="Paid" value={formatAED(totalPaid, true)} color="#10B981" />
              <Stat label="Outstanding" value={formatAED(totalOutstanding, true)} color="#F59E0B" />
              <Stat label="Properties" value={String(properties.length)} />
            </div>
          </div>

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
            <div className="space-y-3">
              {properties.map(p => (
                <PropertyCard key={p.id} property={p} onClick={() => setDetail(p)} />
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
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4A4960" strokeWidth="1.5" strokeLinecap="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
      <h2 className="text-xl font-bold mb-2" style={{ color: '#9B9AB0' }}>No properties yet</h2>
      <p className="text-sm leading-relaxed mb-8" style={{ color: '#4A4960' }}>
        {hasAccounts
          ? 'Your email is connected. We\'re scanning for properties — check back shortly.'
          : 'Connect your email and we\'ll automatically find all your developer communications and build your portfolio.'}
      </p>
      {!hasAccounts && (
        <button
          onClick={onConnectClick}
          className="py-4 px-8 rounded-2xl font-semibold text-base active:scale-95 transition-all"
          style={{ background: 'linear-gradient(135deg, #7C6FED, #A78BFA)', color: 'white' }}
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

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl p-4 transition-all active:scale-98"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {/* Dev color bar */}
      <div className={`h-0.5 rounded-full bg-gradient-to-r ${colorClass} mb-3`} />

      <div className="flex items-start justify-between mb-1">
        <h3 className="font-semibold text-[15px] leading-tight pr-2" style={{ color: '#F1F0FF', fontFamily: 'system-ui' }}>
          {p.project_name}
        </h3>
        <span className="text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0"
          style={{ background: 'rgba(124,111,237,0.15)', color: '#A78BFA' }}>
          {p.property_type || 'Unit'}
        </span>
      </div>

      <p className="text-[12px] mb-3 font-medium" style={{ color: '#4A4960' }}>
        {p.developer} · {p.location || p.emirate}
        {p.unit_number && ` · ${p.unit_number}`}
      </p>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex justify-between text-[11px] mb-1.5">
          <span style={{ color: '#4A4960' }}>Payment progress</span>
          <span className="font-semibold" style={{ color: '#A78BFA' }}>{progress}%</span>
        </div>
        <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #7C6FED, #A78BFA)' }}
          />
        </div>
      </div>

      {/* Financials */}
      <div className="flex gap-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <MiniStat label="Total" value={formatAED(p.total_value, true)} />
        <MiniStat label="Next due" value={nextMilestone ? formatAED(nextMilestone.amount, true) : '—'} highlight />
        <MiniStat label="Due date" value={nextMilestone?.due_date
          ? new Date(nextMilestone.due_date).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })
          : (nextMilestone?.due_label || '—')} />
      </div>
    </button>
  )
}

function NextPaymentCard({ milestone, onClick }: { milestone: any; onClick: () => void }) {
  const days = milestone.due_date ? daysUntil(milestone.due_date) : null
  const urgency = days !== null ? getUrgencyClass(days) : 'future'
  const urgencyColor = urgency === 'overdue' ? '#EF4444' : urgency === 'urgent' ? '#F59E0B' : '#A78BFA'
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
        <p className="font-semibold text-[14px] truncate" style={{ color: '#F1F0FF' }}>
          {milestone.property.project_name}
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: '#6B6A7F' }}>{milestone.label}</p>
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
      <p className="text-[12px] font-semibold tracking-wider uppercase" style={{ color: '#6B6A7F' }}>{title}</p>
      {right && <p className="text-[12px]" style={{ color: '#A78BFA' }}>{right}</p>}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#4A4960' }}>{label}</p>
      <p className="text-[15px] font-semibold" style={{ color: color || '#F1F0FF' }}>{value}</p>
    </div>
  )
}

function MiniStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex-1">
      <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: '#4A4960' }}>{label}</p>
      <p className="text-[13px] font-semibold" style={{ color: highlight ? '#F59E0B' : '#F1F0FF' }}>{value}</p>
    </div>
  )
}
