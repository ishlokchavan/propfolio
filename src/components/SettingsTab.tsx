'use client'

import { useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/lib/types'

interface Props {
  user: User
  profile: Profile | null
  onSignOut: () => void
  onCurrencyChange: (primary: string, secondary: string) => void
}

const CURRENCIES = ['AED', 'INR', 'USD', 'GBP', 'EUR']

export default function SettingsTab({ user, profile, onSignOut, onCurrencyChange }: Props) {
  const [primary, setPrimary] = useState(profile?.primary_currency || 'AED')
  const [secondary, setSecondary] = useState(profile?.secondary_currency || 'INR')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function saveCurrency(newPrimary: string, newSecondary: string) {
    setSaving(true)
    setPrimary(newPrimary)
    setSecondary(newSecondary)
    await supabase.from('profiles').update({
      primary_currency: newPrimary,
      secondary_currency: newSecondary,
    }).eq('id', user.id)
    onCurrencyChange(newPrimary, newSecondary)
    setSaving(false)
  }

  return (
    <div className="h-full overflow-y-auto scroll-smooth">
      <div className="px-5" style={{ paddingTop: 'max(env(safe-area-inset-top, 16px), 20px)' }}>
        <p className="text-[11px] font-semibold tracking-widest uppercase mb-1" style={{ color: '#A78BFA' }}>Settings</p>
        <h1 className="text-3xl font-bold mb-5" style={{ color: '#F1F0FF', fontFamily: 'system-ui' }}>Profile</h1>
      </div>

      {/* Profile card */}
      <div className="mx-4 mb-4 p-4 rounded-2xl flex items-center gap-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #7C6FED, #A78BFA)', color: 'white' }}>
          {(profile?.full_name || user.email || 'U')[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-[16px] truncate" style={{ color: '#F1F0FF' }}>
            {profile?.full_name || 'Investor'}
          </p>
          <p className="text-[13px] truncate" style={{ color: '#6B6A7F' }}>{user.email}</p>
        </div>
      </div>

      {/* Currency */}
      <div className="mx-4 mb-4 p-4 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-[12px] font-bold uppercase tracking-wider mb-1" style={{ color: '#6B6A7F' }}>Currency</p>
        <p className="text-[12px] mb-4" style={{ color: '#4A4960' }}>
          Amounts show in your primary currency with the secondary underneath.
        </p>

        <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#4A4960' }}>Primary</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {CURRENCIES.map(c => (
            <CurrencyChip key={c} code={c} active={primary === c} disabled={saving || c === secondary}
              onClick={() => saveCurrency(c, secondary)} />
          ))}
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#4A4960' }}>Secondary</p>
        <div className="flex flex-wrap gap-2">
          <CurrencyChip code="None" active={secondary === 'none'} disabled={saving}
            onClick={() => saveCurrency(primary, 'none')} />
          {CURRENCIES.map(c => (
            <CurrencyChip key={c} code={c} active={secondary === c} disabled={saving || c === primary}
              onClick={() => saveCurrency(primary, c)} />
          ))}
        </div>
      </div>

      {/* About */}
      <div className="mx-4 mb-4 rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <a href="/privacy" className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-[14px] font-medium" style={{ color: '#F1F0FF' }}>Privacy Policy</span>
          <Chevron />
        </a>
        <div className="flex items-center justify-between px-4 py-3.5">
          <span className="text-[14px] font-medium" style={{ color: '#F1F0FF' }}>Version</span>
          <span className="text-[13px]" style={{ color: '#4A4960' }}>1.0.0</span>
        </div>
      </div>

      {/* Sign out */}
      <div className="mx-4 mb-8">
        <button
          onClick={onSignOut}
          className="w-full py-4 rounded-2xl font-semibold text-[15px] active:scale-95 transition-all"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

function CurrencyChip({ code, active, disabled, onClick }: { code: string; active: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 rounded-full text-[13px] font-bold transition-all active:scale-95 disabled:opacity-30"
      style={active
        ? { background: 'linear-gradient(135deg, #7C6FED, #A78BFA)', color: 'white' }
        : { background: 'var(--surface2)', color: '#9B9AB0', border: '1px solid var(--border)' }}
    >
      {code}
    </button>
  )
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4A4960" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  )
}
