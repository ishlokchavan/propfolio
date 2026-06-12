'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Property, EmailAccount, Profile, PaymentMilestone } from '@/lib/types'
import PortfolioTab from './PortfolioTab'
import PaymentsTab from './PaymentsTab'
import ConnectTab from './ConnectTab'
import SettingsTab from './SettingsTab'

interface Props {
  user: User
  profile: Profile | null
  properties: Property[]
  emailAccounts: EmailAccount[]
}

type Tab = 'portfolio' | 'payments' | 'connect' | 'settings'

export default function DashboardShell({ user, profile, properties, emailAccounts }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('portfolio')
  const [localProperties, setLocalProperties] = useState(properties)
  const [localAccounts, setLocalAccounts] = useState(emailAccounts)
  const supabase = createClient()
  const [currency, setCurrency] = useState({
    primary: profile?.primary_currency || 'AED',
    secondary: profile?.secondary_currency || 'INR',
  })
  const [rates, setRates] = useState<Record<string, number>>({ AED: 1 })

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/AED')
      .then(r => r.json())
      .then(d => { if (d?.rates) setRates({ AED: 1, ...d.rates }) })
      .catch(() => {})
  }, [])

  const hasData = localProperties.length > 0

  // Fallback: capture the Gmail/Outlook provider token client-side.
  // Supabase keeps provider_token in the stored session right after OAuth —
  // this catches it even if the server callback missed the write.
  useEffect(() => {
    async function captureProviderToken() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.provider_token || !session.user.email) return

      const hint = localStorage.getItem('pf_link_provider')
      const rawProvider = hint || session.user.app_metadata.provider
      const provider = rawProvider === 'azure' ? 'microsoft' : 'google'
      const identity = (session.user.identities || []).find(i => i.provider === rawProvider)
      const accountEmail = (identity?.identity_data?.email as string) || session.user.email
      localStorage.removeItem('pf_link_provider')
      const { data: upserted, error } = await supabase
        .from('email_accounts')
        .upsert(
          {
            user_id: session.user.id,
            provider,
            email: accountEmail,
            access_token: session.provider_token,
            refresh_token: session.provider_refresh_token || null,
            token_expires_at: new Date(Date.now() + 55 * 60 * 1000).toISOString(),
            sync_status: 'pending',
          },
          { onConflict: 'user_id,email' }
        )
        .select()
        .single()

      if (!error && upserted) {
        setLocalAccounts(prev => {
          if (prev.some(a => a.id === upserted.id)) {
            return prev.map(a => a.id === upserted.id ? upserted : a)
          }
          return [...prev, upserted]
        })
      }
    }
    captureProviderToken()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const waSummary = (() => {
    if (localProperties.length === 0) return 'Tracking my UAE property portfolio with Propfolio \u2014 https://propfolio-nu.vercel.app'
    const total = localProperties.reduce((s, p) => s + p.total_value, 0)
    const paid = localProperties.reduce((s, p) => s + p.paid_amount, 0)
    const lines = localProperties.map(p =>
      `\u2022 ${p.project_name} (${p.developer}) \u2014 AED ${(p.total_value / 1e6).toFixed(2)}M, ${Math.round((p.paid_amount / p.total_value) * 100)}% paid`
    )
    return `\ud83c\udfd7\ufe0f My Property Portfolio\n\nTotal: AED ${(total / 1e6).toFixed(2)}M \u00b7 Paid: AED ${(paid / 1e6).toFixed(2)}M\n${localProperties.length} properties:\n${lines.join('\n')}\n\nTracked with Propfolio`
  })()

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div
      className="flex flex-col lg:flex-row w-full lg:max-w-6xl mx-auto"
      style={{ height: '100dvh', background: 'var(--bg)', position: 'relative' }}
    >
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 px-4 py-8 gap-1"
        style={{ borderRight: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 px-3 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent2))' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <span className="font-bold text-lg" style={{ color: 'var(--text)' }}>Propfolio</span>
        </div>
        {([['portfolio', 'Portfolio'], ['payments', 'Payments'], ['connect', 'Emails'], ['settings', 'Settings']] as Array<[Tab, string]>).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="text-left px-4 py-3 rounded-xl text-[14px] font-semibold transition-all"
            style={activeTab === tab
              ? { background: 'var(--surface2)', color: 'var(--accent2)' }
              : { color: 'var(--text3)' }}>
            {label}
          </button>
        ))}
      </aside>

      <div className="flex flex-col flex-1 min-w-0" style={{ height: '100dvh' }}>
      {/* Screen content */}
      <div className="flex-1 overflow-hidden relative">
        <div className={activeTab === 'portfolio' ? 'block h-full' : 'hidden'}>
          <PortfolioTab
            properties={localProperties}
            hasAccounts={localAccounts.length > 0}
            onConnectClick={() => setActiveTab('connect')}
            currency={currency}
            rates={rates}
          />
        </div>
        <div className={activeTab === 'payments' ? 'block h-full' : 'hidden'}>
          <PaymentsTab properties={localProperties} />
        </div>
        <div className={activeTab === 'connect' ? 'block h-full' : 'hidden'}>
          <ConnectTab
            user={user}
            accounts={localAccounts}
            onAccountAdded={(acc) => setLocalAccounts(prev => [...prev, acc])}
            onAccountRemoved={(id) => setLocalAccounts(prev => prev.filter(a => a.id !== id))}
            onPropertiesFound={(props) => setLocalProperties(prev => [...prev, ...props])}
            onSignOut={signOut}
          />
        </div>
        <div className={activeTab === 'settings' ? 'block h-full' : 'hidden'}>
          <SettingsTab
            user={user}
            profile={profile}
            onSignOut={signOut}
            onCurrencyChange={(primary, secondary) => setCurrency({ primary, secondary })}
            waSummary={waSummary}
          />
        </div>
      </div>

      {/* Bottom nav (mobile/tablet) */}
      <nav
        className="lg:hidden"
        style={{
          background: 'var(--nav-bg)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--border)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          flexShrink: 0,
        }}
      >
        <div className="flex justify-around items-center py-2">
          <NavItem
            label="Portfolio"
            active={activeTab === 'portfolio'}
            onClick={() => setActiveTab('portfolio')}
            badge={hasData ? localProperties.length : undefined}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
          </NavItem>
          <NavItem
            label="Payments"
            active={activeTab === 'payments'}
            onClick={() => setActiveTab('payments')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
              <rect x="2" y="5" width="20" height="14" rx="2"/>
              <line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
          </NavItem>
          <NavItem
            label="Emails"
            active={activeTab === 'connect'}
            onClick={() => setActiveTab('connect')}
            badge={localAccounts.length > 0 ? localAccounts.length : undefined}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </NavItem>
          <NavItem
            label="Settings"
            active={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </NavItem>
        </div>
      </nav>
      </div>
    </div>
  )
}

function NavItem({
  label, active, onClick, badge, children
}: {
  label: string; active: boolean; onClick: () => void; badge?: number; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all active:scale-95"
      style={{ color: active ? 'var(--accent2)' : 'var(--text4)', position: 'relative' }}
    >
      <span style={{ filter: active ? 'drop-shadow(0 0 8px rgba(167,139,250,0.6))' : 'none' }}>
        {children}
      </span>
      <span className="text-[10px] font-medium">{label}</span>
      {badge !== undefined && (
        <span
          className="absolute top-1 right-3 text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}
