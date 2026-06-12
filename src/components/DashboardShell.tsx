'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Property, EmailAccount, Profile, PaymentMilestone } from '@/lib/types'
import PortfolioTab from './PortfolioTab'
import PaymentsTab from './PaymentsTab'
import ConnectTab from './ConnectTab'

interface Props {
  user: User
  profile: Profile | null
  properties: Property[]
  emailAccounts: EmailAccount[]
}

type Tab = 'portfolio' | 'payments' | 'connect'

export default function DashboardShell({ user, profile, properties, emailAccounts }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('portfolio')
  const [localProperties, setLocalProperties] = useState(properties)
  const [localAccounts, setLocalAccounts] = useState(emailAccounts)
  const supabase = createClient()

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

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div
      className="flex flex-col"
      style={{
        height: '100dvh',
        background: 'var(--bg)',
        maxWidth: 480,
        margin: '0 auto',
        position: 'relative',
      }}
    >
      {/* Screen content */}
      <div className="flex-1 overflow-hidden relative">
        <div className={activeTab === 'portfolio' ? 'block h-full' : 'hidden'}>
          <PortfolioTab
            properties={localProperties}
            hasAccounts={localAccounts.length > 0}
            onConnectClick={() => setActiveTab('connect')}
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
      </div>

      {/* Bottom nav */}
      <nav
        style={{
          background: 'rgba(9,9,14,0.95)',
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
        </div>
      </nav>
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
      className="flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-all active:scale-95"
      style={{ color: active ? '#A78BFA' : '#4A4960', position: 'relative' }}
    >
      <span style={{ filter: active ? 'drop-shadow(0 0 8px rgba(167,139,250,0.6))' : 'none' }}>
        {children}
      </span>
      <span className="text-[10px] font-medium">{label}</span>
      {badge !== undefined && (
        <span
          className="absolute top-1 right-3 text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
          style={{ background: '#7C6FED', color: 'white' }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}
