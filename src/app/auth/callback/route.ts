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
      // Capture the Google/Microsoft provider token for email scanning
      const { session, user } = data
      const providerToken = session.provider_token
      const providerRefreshToken = session.provider_refresh_token
      const provider = user.app_metadata.provider === 'azure' ? 'microsoft' : 'google'

      if (providerToken && user.email) {
        // Store/update the email account with tokens for Gmail/Outlook API access
        await supabase.from('email_accounts').upsert(
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
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`)
}
