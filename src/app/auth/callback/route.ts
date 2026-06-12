import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.session) {
      const { session, user } = data
      const providerToken = session.provider_token
      const providerRefreshToken = session.provider_refresh_token
      const provider = user.app_metadata.provider === 'azure' ? 'microsoft' : 'google'

      console.log('[auth/callback] user:', user.email, 'provider:', provider, 'has_token:', !!providerToken, 'has_refresh:', !!providerRefreshToken)

      if (providerToken && user.email) {
        const { error: upsertError } = await supabase.from('email_accounts').upsert(
          {
            user_id: user.id,
            provider,
            email: user.email,
            access_token: providerToken,
            refresh_token: providerRefreshToken || null,
            token_expires_at: new Date(Date.now() + 55 * 60 * 1000).toISOString(),
            sync_status: 'pending',
          },
          { onConflict: 'user_id,email' }
        )
        if (upsertError) {
          console.error('[auth/callback] email_accounts upsert failed:', upsertError.message)
        } else {
          console.log('[auth/callback] email account stored for', user.email)
        }
      } else {
        console.warn('[auth/callback] no provider_token in session — Gmail scope may not have been granted')
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('[auth/callback] exchange failed:', error?.message)
  }

  return NextResponse.redirect(`${origin}/?error=auth`)
}
