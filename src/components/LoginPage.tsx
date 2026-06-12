'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [loading, setLoading] = useState<'google' | 'microsoft' | null>(null)
  const supabase = createClient()

  async function signIn(provider: 'google' | 'azure') {
    const label = provider === 'google' ? 'google' : 'microsoft'
    setLoading(label as 'google' | 'microsoft')
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${location.origin}/auth/callback`,
        scopes: provider === 'google'
          ? 'email profile https://www.googleapis.com/auth/gmail.readonly'
          : 'email profile offline_access https://graph.microsoft.com/Mail.Read',
      },
    })
  }

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Top gradient blob */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, #7C6FED 0%, transparent 70%)' }}
      />

      <div className="flex-1 flex flex-col justify-center px-6 py-12 relative z-10">
        {/* Logo */}
        <div className="mb-12 text-center">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #7C6FED, #A78BFA)' }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: '#F1F0FF', fontFamily: 'system-ui' }}
          >
            Propfolio
          </h1>
          <p className="mt-2 text-base" style={{ color: '#6B6A7F' }}>
            All your UAE property investments,<br />in one place.
          </p>
        </div>

        {/* Value props */}
        <div className="space-y-3 mb-10">
          {[
            { icon: '📧', text: 'Connect your email — we find everything automatically' },
            { icon: '🏗️', text: 'Every property, payment plan and milestone' },
            { icon: '📅', text: 'Never miss a payment due date again' },
          ].map((item) => (
            <div
              key={item.text}
              className="flex items-start gap-3 p-3 rounded-xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <span className="text-lg leading-none mt-0.5">{item.icon}</span>
              <p className="text-sm leading-snug" style={{ color: '#9B9AB0' }}>{item.text}</p>
            </div>
          ))}
        </div>

        {/* Auth buttons */}
        <div className="space-y-3">
          <button
            onClick={() => signIn('google')}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-semibold text-base transition-all active:scale-95 disabled:opacity-60"
            style={{ background: 'white', color: '#1a1a2e' }}
          >
            {loading === 'google' ? (
              <Spinner />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            Continue with Google
          </button>

          <button
            onClick={() => signIn('azure')}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-semibold text-base transition-all active:scale-95 disabled:opacity-60"
            style={{ background: 'var(--surface2)', color: '#F1F0FF', border: '1px solid var(--border)' }}
          >
            {loading === 'microsoft' ? (
              <Spinner light />
            ) : (
              <svg width="20" height="20" viewBox="0 0 23 23">
                <path fill="#f25022" d="M1 1h10v10H1z"/>
                <path fill="#00a4ef" d="M12 1h10v10H12z"/>
                <path fill="#7fba00" d="M1 12h10v10H1z"/>
                <path fill="#ffb900" d="M12 12h10v10H12z"/>
              </svg>
            )}
            Continue with Microsoft
          </button>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#4A4960' }}>
          We read emails to find your property data.<br />We never send emails on your behalf.
        </p>
      </div>
    </div>
  )
}

function Spinner({ light }: { light?: boolean }) {
  return (
    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={light ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)'} strokeWidth="3"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke={light ? 'white' : '#1a1a2e'} strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}
