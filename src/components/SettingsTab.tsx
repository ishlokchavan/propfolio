'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/lib/types'

interface Props {
  user: User
  profile: Profile | null
  onSignOut: () => void
  onCurrencyChange: (primary: string, secondary: string) => void
  waSummary: string
  emailSection: React.ReactNode
}

const CURRENCIES = ['AED', 'INR', 'USD', 'GBP', 'EUR']

export default function SettingsTab({ user, profile, onSignOut, onCurrencyChange, waSummary, emailSection }: Props) {
  const [primary, setPrimary] = useState(profile?.primary_currency || 'AED')
  const [secondary, setSecondary] = useState(profile?.secondary_currency || 'INR')
  const [saving, setSaving] = useState(false)
  const [theme, setTheme] = useState('system')
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [shares, setShares] = useState<Array<{ id: string; member_email: string }>>([])
  const [shareInput, setShareInput] = useState('')
  const supabase = createClient()

  useEffect(() => {
    setTheme(localStorage.getItem('pf_theme') || 'system')
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.getRegistration().then(reg =>
        reg?.pushManager.getSubscription().then(sub => setPushEnabled(!!sub))
      )
    }
    supabase.from('portfolio_shares').select('id, member_email').eq('owner_id', user.id)
      .then(({ data }) => setShares(data || []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyTheme(pref: string) {
    setTheme(pref)
    localStorage.setItem('pf_theme', pref)
    const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }

  async function togglePush() {
    setPushBusy(true)
    try {
      if (pushEnabled) {
        const reg = await navigator.serviceWorker.getRegistration()
        const sub = await reg?.pushManager.getSubscription()
        if (sub) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          await sub.unsubscribe()
        }
        setPushEnabled(false)
      } else {
        const perm = await Notification.requestPermission()
        if (perm !== 'granted') { setPushBusy(false); return }
        const reg = await navigator.serviceWorker.register('/sw.js')
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        })
        const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
        await supabase.from('push_subscriptions').upsert({
          user_id: user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth,
        }, { onConflict: 'endpoint' })
        setPushEnabled(true)
      }
    } catch { /* permission blocked or unsupported */ }
    setPushBusy(false)
  }

  async function addShare() {
    const email = shareInput.trim().toLowerCase()
    if (!email.includes('@')) return
    const { data } = await supabase.from('portfolio_shares')
      .insert({ owner_id: user.id, member_email: email }).select('id, member_email').single()
    if (data) { setShares(prev => [...prev, data]); setShareInput('') }
  }

  async function removeShare(id: string) {
    await supabase.from('portfolio_shares').delete().eq('id', id)
    setShares(prev => prev.filter(s => s.id !== id))
  }

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
    <div className="h-full overflow-y-auto scroll-smooth anim-tab">
      <div className="px-5" style={{ paddingTop: 'max(env(safe-area-inset-top, 16px), 20px)' }}>
        <p className="text-[11px] font-semibold tracking-widest uppercase mb-1" style={{ color: 'var(--accent2)' }}>Settings</p>
        <h1 className="text-3xl font-bold mb-5" style={{ color: 'var(--text)', fontFamily: 'system-ui' }}>Profile</h1>
      </div>

      {/* Profile card */}
      <div className="mx-4 mb-4 p-4 rounded-2xl flex items-center gap-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white' }}>
          {(profile?.full_name || user.email || 'U')[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-[16px] truncate" style={{ color: 'var(--text)' }}>
            {profile?.full_name || 'Investor'}
          </p>
          <p className="text-[13px] truncate" style={{ color: 'var(--text3)' }}>{user.email}</p>
        </div>
      </div>

      {/* Connected emails */}
      <div className="mx-4 mb-4 p-4 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-[12px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text3)' }}>Connected Emails</p>
        <p className="text-[12px] mb-2" style={{ color: 'var(--text4)' }}>
          We scan these inboxes to keep your portfolio in sync.
        </p>
        {emailSection}
      </div>

      {/* Currency */}
      <div className="mx-4 mb-4 p-4 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-[12px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text3)' }}>Currency</p>
        <p className="text-[12px] mb-4" style={{ color: 'var(--text4)' }}>
          Amounts show in your primary currency with the secondary underneath.
        </p>

        <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text4)' }}>Primary</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {CURRENCIES.map(c => (
            <CurrencyChip key={c} code={c} active={primary === c} disabled={saving || c === secondary}
              onClick={() => saveCurrency(c, secondary)} />
          ))}
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text4)' }}>Secondary</p>
        <div className="flex flex-wrap gap-2">
          <CurrencyChip code="None" active={secondary === 'none'} disabled={saving}
            onClick={() => saveCurrency(primary, 'none')} />
          {CURRENCIES.map(c => (
            <CurrencyChip key={c} code={c} active={secondary === c} disabled={saving || c === primary}
              onClick={() => saveCurrency(primary, c)} />
          ))}
        </div>
      </div>

      {/* Theme */}
      <div className="mx-4 mb-4 p-4 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-[12px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text3)' }}>Appearance</p>
        <div className="flex gap-2">
          {[['light', 'Light'], ['dark', 'Dark'], ['system', 'System']].map(([v, label]) => (
            <button key={v} onClick={() => applyTheme(v)}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-bold tap"
              style={theme === v
                ? { background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white' }
                : { background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div className="mx-4 mb-4 p-4 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <div className="pr-3">
            <p className="text-[14px] font-bold" style={{ color: 'var(--text)' }}>Payment reminders</p>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--text4)' }}>Push alerts 7, 3 and 1 day before each due date</p>
          </div>
          <button onClick={togglePush} disabled={pushBusy}
            className="w-[52px] h-[30px] rounded-full flex-shrink-0 transition-all relative disabled:opacity-50"
            style={{ background: pushEnabled ? 'var(--accent)' : 'var(--surface2)', border: '1px solid var(--border)' }}>
            <span className="absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow" style={{ transition: 'left 0.28s cubic-bezier(0.34,1.56,0.64,1)', left: pushEnabled ? 26 : 3 }} data-thumb />
          </button>
        </div>
        <p className="text-[11px] mt-2.5" style={{ color: 'var(--text4)' }}>
          On iPhone: add Propfolio to your Home Screen first, then enable here.
        </p>
      </div>

      {/* Shared access */}
      <div className="mx-4 mb-4 p-4 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-[12px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text3)' }}>Shared Access</p>
        <p className="text-[12px] mb-3" style={{ color: 'var(--text4)' }}>
          Give someone read-only access to this portfolio — they sign in with their own email and see your properties.
        </p>
        {shares.map(s => (
          <div key={s.id} className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
            <p className="text-[13px] font-medium truncate pr-3" style={{ color: 'var(--text)' }}>{s.member_email}</p>
            <button onClick={() => removeShare(s.id)} className="text-[12px] font-bold flex-shrink-0" style={{ color: 'var(--red)' }}>Remove</button>
          </div>
        ))}
        <div className="flex gap-2 mt-3">
          <input value={shareInput} onChange={e => setShareInput(e.target.value)}
            placeholder="rajni@gmail.com" type="email"
            className="flex-1 px-3.5 py-2.5 rounded-xl text-[14px] outline-none min-w-0"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          <button onClick={addShare}
            className="px-4 py-2.5 rounded-xl text-[13px] font-bold flex-shrink-0 tap"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white' }}>
            Invite
          </button>
        </div>
      </div>

      {/* WhatsApp share */}
      <div className="mx-4 mb-4">
        <a href={`https://wa.me/?text=${encodeURIComponent(waSummary)}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2.5 w-full py-4 rounded-2xl font-bold text-[15px] active:scale-95 transition-all"
          style={{ background: 'rgba(37,211,102,0.12)', color: '#1DAA52', border: '1px solid rgba(37,211,102,0.3)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.5 0 1.47 1.07 2.89 1.22 3.09.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.42.25-.7.25-1.3.18-1.42-.08-.13-.28-.2-.58-.35zM12.04 21.5h-.01a9.5 9.5 0 01-4.84-1.32l-.35-.2-3.6.94.96-3.5-.23-.36a9.45 9.45 0 01-1.46-5.06c0-5.24 4.27-9.5 9.52-9.5a9.46 9.46 0 016.73 2.79 9.43 9.43 0 012.79 6.72c0 5.24-4.27 9.5-9.51 9.5zm8.09-17.58A11.4 11.4 0 0012.04.5C5.7.5.54 5.65.54 11.99c0 2.02.53 4 1.53 5.74L.44 23.5l5.92-1.55a11.5 11.5 0 005.67 1.49h.01c6.33 0 11.49-5.15 11.49-11.5 0-3.07-1.2-5.95-3.4-8.12z"/></svg>
          Share portfolio on WhatsApp
        </a>
      </div>

      {/* About */}
      <div className="mx-4 mb-4 rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <a href="/privacy" className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-[14px] font-medium" style={{ color: 'var(--text)' }}>Privacy Policy</span>
          <Chevron />
        </a>
        <div className="flex items-center justify-between px-4 py-3.5">
          <span className="text-[14px] font-medium" style={{ color: 'var(--text)' }}>Version</span>
          <span className="text-[13px]" style={{ color: 'var(--text4)' }}>1.0.0</span>
        </div>
      </div>

      {/* Sign out */}
      <div className="mx-4 mb-8">
        <button
          onClick={onSignOut}
          className="w-full py-4 rounded-2xl font-semibold text-[15px] tap"
          style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)' }}
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
      className="px-4 py-2 rounded-full text-[13px] font-bold tap disabled:opacity-30"
      style={active
        ? { background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white' }
        : { background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)' }}
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
