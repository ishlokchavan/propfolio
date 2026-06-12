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
