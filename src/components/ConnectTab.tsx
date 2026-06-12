'use client'

import { useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { EmailAccount, Property } from '@/lib/types'

interface Props {
  user: User
  accounts: EmailAccount[]
  onAccountAdded: (acc: EmailAccount) => void
  onAccountRemoved: (id: string) => void
  onPropertiesFound: (props: Property[]) => void
}

type SyncState = 'idle' | 'syncing' | 'done' | 'error'

export default function ConnectTab({ user, accounts, onAccountAdded, onAccountRemoved, onPropertiesFound }: Props) {
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [syncLog, setSyncLog] = useState<Array<{ text: string; type: string }>>([])
  const [connecting, setConnecting] = useState<'google' | 'microsoft' | null>(null)
  const supabase = createClient()

  async function connectGoogle() {
    setConnecting('google')
    // In production: OAuth flow that grants Gmail read access
    // For now: show the OAuth button that uses Supabase's built-in Google OAuth
    // The access token from sign-in includes Gmail scope if configured
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback`,
        scopes: 'https://www.googleapis.com/auth/gmail.readonly',
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    setConnecting(null)
  }

  async function connectMicrosoft() {
    setConnecting('microsoft')
    await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: `${location.origin}/auth/callback`,
        scopes: 'https://graph.microsoft.com/Mail.Read offline_access',
      },
    })
    setConnecting(null)
  }

  async function removeAccount(id: string) {
    await supabase.from('email_accounts').delete().eq('id', id)
    onAccountRemoved(id)
  }

  async function triggerSync(accountId: string) {
    setSyncState('syncing')
    setSyncLog([{ text: 'Connecting to your inbox...', type: 'info' }])

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'token_expired') {
          setSyncLog(prev => [...prev, { text: 'Email access expired — please sign out and sign in again to reconnect.', type: 'error' }])
        } else {
          setSyncLog(prev => [...prev, { text: data.message || 'Sync failed. Try again.', type: 'error' }])
        }
        setSyncState('error')
        return
      }

      // Show server log
      if (data.log) {
        setSyncLog(prev => [...prev, ...data.log.map((l: { message: string; type: string }) => ({ text: l.message, type: l.type }))])
      }

      if (data.properties?.length > 0) {
        onPropertiesFound(data.properties)
      }

      setSyncState('done')

      // Reload to fetch fresh data with milestones
      if (data.propertiesFound > 0) {
        setTimeout(() => window.location.reload(), 1500)
      }
    } catch {
      setSyncLog(prev => [...prev, { text: 'Network error — check your connection and try again.', type: 'error' }])
      setSyncState('error')
    }
  }

  const hasAccounts = accounts.length > 0

  return (
    <div className="h-full overflow-y-auto scroll-smooth">
      <div className="px-5" style={{ paddingTop: 'max(env(safe-area-inset-top, 16px), 20px)' }}>
        <p className="text-[11px] font-semibold tracking-widest uppercase mb-1" style={{ color: '#A78BFA' }}>Email Sync</p>
        <h1 className="text-3xl font-bold mb-1" style={{ color: '#F1F0FF', fontFamily: 'system-ui' }}>Connect</h1>
        <p className="text-sm mb-5" style={{ color: '#6B6A7F' }}>
          Add the email{hasAccounts ? 's' : ''} you registered with your developers
        </p>
      </div>

      {/* Connected accounts */}
      {hasAccounts && (
        <div className="mx-4 mb-4 space-y-2">
          {accounts.map((acc, i) => (
            <AccountRow
              key={acc.id}
              account={acc}
              index={i}
              onRemove={() => removeAccount(acc.id)}
              onSync={() => triggerSync(acc.id)}
              isSyncing={syncState === 'syncing'}
            />
          ))}
        </div>
      )}

      {/* Sync log */}
      {syncLog.length > 0 && (
        <div className="mx-4 mb-4 p-4 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: '#6B6A7F' }}>
            {syncState === 'syncing' ? 'Scanning...' : 'Scan complete'}
          </p>
          <div className="space-y-2">
            {syncLog.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: l.type === 'found' ? '#10B981' : l.type === 'processing' ? '#A78BFA' : l.type === 'error' ? '#EF4444' : '#4A4960' }} />
                <p className="text-[12px]"
                  style={{ color: l.type === 'found' ? '#10B981' : l.type === 'processing' ? '#A78BFA' : l.type === 'error' ? '#EF4444' : '#6B6A7F' }}>
                  {l.text}
                </p>
              </div>
            ))}
            {syncState === 'syncing' && (
              <div className="flex items-center gap-2 mt-1">
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#A78BFA' }} />
                <p className="text-[12px]" style={{ color: '#A78BFA' }}>Processing...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add new account */}
      {!hasAccounts && (
        <div className="mx-4 mb-4 p-5 rounded-2xl text-center"
          style={{ background: 'linear-gradient(135deg, #1a1535, #12122a)', border: '1px solid rgba(124,111,237,0.2)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, #7C6FED, #A78BFA)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <h3 className="font-bold text-lg mb-2" style={{ color: '#F1F0FF' }}>Connect your inbox</h3>
          <p className="text-sm mb-1" style={{ color: '#6B6A7F' }}>
            We scan for emails from DAMAC, Emaar, Sobha, Arada, Nakheel, and any other developer — automatically.
          </p>
        </div>
      )}

      {/* How it works */}
      {!hasAccounts && (
        <div className="mx-4 mb-4 space-y-0" style={{ borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          {[
            { n: '1', title: 'Tap Google or Outlook', sub: 'One tap — no passwords typed' },
            { n: '2', title: 'We scan your emails', sub: 'AI reads developer communications only' },
            { n: '3', title: 'Your portfolio appears', sub: 'Properties, payments, milestones — all automatic' },
          ].map((s, i) => (
            <div key={s.n} className="flex gap-3 px-4 py-3.5" style={{ borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: 'rgba(124,111,237,0.15)', border: '1px solid rgba(124,111,237,0.3)' }}>
                <span className="text-[12px] font-bold" style={{ color: '#A78BFA' }}>{s.n}</span>
              </div>
              <div>
                <p className="text-[14px] font-semibold" style={{ color: '#F1F0FF' }}>{s.title}</p>
                <p className="text-[12px] mt-0.5" style={{ color: '#4A4960' }}>{s.sub}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Connect buttons */}
      <div className="mx-4 mb-6 space-y-3">
        <button
          onClick={connectGoogle}
          disabled={connecting !== null}
          className="w-full flex items-center justify-center gap-3 py-4 px-5 rounded-2xl font-semibold text-base transition-all active:scale-95 disabled:opacity-60"
          style={{ background: 'white', color: '#1a1a2e' }}
        >
          {connecting === 'google' ? (
            <Spinner dark />
          ) : (
            <GoogleIcon />
          )}
          {hasAccounts ? 'Add Google Account' : 'Continue with Google'}
        </button>

        <button
          onClick={connectMicrosoft}
          disabled={connecting !== null}
          className="w-full flex items-center justify-center gap-3 py-4 px-5 rounded-2xl font-semibold text-base transition-all active:scale-95 disabled:opacity-60"
          style={{ background: 'var(--surface2)', color: '#F1F0FF', border: '1px solid var(--border)' }}
        >
          {connecting === 'microsoft' ? (
            <Spinner />
          ) : (
            <MicrosoftIcon />
          )}
          {hasAccounts ? 'Add Outlook Account' : 'Continue with Outlook'}
        </button>
      </div>

      <p className="text-center text-[11px] pb-6 mx-8" style={{ color: '#4A4960' }}>
        Read-only access · We never send emails on your behalf · You can disconnect anytime
      </p>
    </div>
  )
}

function AccountRow({ account, index, onRemove, onSync, isSyncing }: {
  account: EmailAccount; index: number; onRemove: () => void; onSync: () => void; isSyncing: boolean
}) {
  const colors = ['#7C6FED', '#10B981', '#F59E0B', '#EF4444']
  const color = colors[index % colors.length]
  const providerIcon = account.provider === 'google' ? <GoogleIcon small /> : <MicrosoftIcon small />

  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-base"
        style={{ background: `${color}20`, color }}>
        {account.email[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {providerIcon}
          <p className="text-[13px] font-semibold truncate" style={{ color: '#F1F0FF' }}>{account.email}</p>
        </div>
        <p className="text-[11px] mt-0.5" style={{ color: account.sync_status === 'synced' ? '#10B981' : '#A78BFA' }}>
          {account.sync_status === 'synced'
            ? `✓ Synced · ${account.emails_scanned?.toLocaleString() || 0} emails`
            : account.sync_status === 'syncing' ? '⟳ Syncing...' : 'Tap to sync'}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-40"
          style={{ background: 'rgba(124,111,237,0.15)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
        <button
          onClick={onRemove}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{ background: 'rgba(239,68,68,0.1)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

function GoogleIcon({ small }: { small?: boolean }) {
  const size = small ? 14 : 20
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

function MicrosoftIcon({ small }: { small?: boolean }) {
  const size = small ? 14 : 20
  return (
    <svg width={size} height={size} viewBox="0 0 23 23">
      <path fill="#f25022" d="M1 1h10v10H1z"/><path fill="#00a4ef" d="M12 1h10v10H12z"/>
      <path fill="#7fba00" d="M1 12h10v10H1z"/><path fill="#ffb900" d="M12 12h10v10H12z"/>
    </svg>
  )
}

function Spinner({ dark }: { dark?: boolean }) {
  return (
    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={dark ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)'} strokeWidth="3"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke={dark ? '#1a1a2e' : 'white'} strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}

