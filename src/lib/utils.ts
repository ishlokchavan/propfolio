export function formatAED(amount: number, compact = false): string {
  if (compact) {
    if (amount >= 1_000_000) return `AED ${(amount / 1_000_000).toFixed(1)}M`
    if (amount >= 1_000) return `AED ${(amount / 1_000).toFixed(0)}K`
  }
  return `AED ${amount.toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function paymentProgress(paid: number, total: number): number {
  if (total === 0) return 0
  return Math.round((paid / total) * 100)
}

export function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function daysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Due today'
  if (days <= 7) return `${days}d`
  if (days <= 60) return `${Math.round(days / 7)}w`
  return `${Math.round(days / 30)}mo`
}

export function getUrgencyClass(days: number): 'overdue' | 'urgent' | 'upcoming' | 'future' {
  if (days < 0) return 'overdue'
  if (days <= 14) return 'urgent'
  if (days <= 45) return 'upcoming'
  return 'future'
}

export function developerColor(developer: string): string {
  const map: Record<string, string> = {
    damac: 'from-violet-500 to-purple-600',
    emaar: 'from-emerald-500 to-green-600',
    sobha: 'from-amber-500 to-yellow-600',
    arada: 'from-red-500 to-rose-600',
    nakheel: 'from-blue-500 to-indigo-600',
    meraas: 'from-pink-500 to-fuchsia-600',
    aldar: 'from-teal-500 to-cyan-600',
    prescott: 'from-sky-500 to-cyan-600',
    ayat: 'from-indigo-500 to-blue-600',
  }
  const key = developer.toLowerCase()
  for (const [k, v] of Object.entries(map)) {
    if (key.includes(k)) return v
  }
  return 'from-slate-500 to-gray-600'
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export interface ResaleStatus {
  eligible: boolean
  paidPct: number
  threshold: number
  amountToEligibility: number
}

export function resaleStatus(paid: number, total: number, threshold: number | null): ResaleStatus | null {
  if (!threshold || total === 0) return null
  const paidPct = (paid / total) * 100
  const eligible = paidPct >= threshold
  const amountToEligibility = eligible ? 0 : Math.ceil((threshold / 100) * total - paid)
  return { eligible, paidPct: Math.round(paidPct), threshold, amountToEligibility }
}

const CURRENCY_SYMBOLS: Record<string, string> = { AED: 'AED', INR: '\u20B9', USD: '$', GBP: '\u00A3', EUR: '\u20AC' }

export function formatMoney(amountAED: number, currency: string, rates: Record<string, number>, compact = true): string {
  const rate = currency === 'AED' ? 1 : (rates[currency] || 0)
  if (rate === 0) return ''
  const v = amountAED * rate
  const sym = CURRENCY_SYMBOLS[currency] || currency
  if (compact) {
    if (currency === 'INR') {
      if (v >= 1e7) return `${sym}${(v / 1e7).toFixed(2)} Cr`
      if (v >= 1e5) return `${sym}${(v / 1e5).toFixed(1)} L`
    }
    if (v >= 1e6) return `${sym}${(v / 1e6).toFixed(2)}M`
    if (v >= 1e3) return `${sym}${(v / 1e3).toFixed(0)}K`
  }
  return `${sym}${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

export function cashflowByYear(milestones: Array<{ amount: number; due_date: string | null; due_label: string | null; status: string }>): Array<{ year: string; total: number }> {
  const map = new Map<string, number>()
  for (const m of milestones) {
    if (m.status === 'paid') continue
    let year: string | null = null
    if (m.due_date) year = m.due_date.slice(0, 4)
    else if (m.due_label) {
      const match = m.due_label.match(/20\d{2}/)
      if (match) year = match[0]
    }
    if (!year) year = 'TBD'
    map.set(year, (map.get(year) || 0) + m.amount)
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([year, total]) => ({ year, total }))
}
