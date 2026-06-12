import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import webpush from 'web-push'

export const maxDuration = 60

// Daily cron (vercel.json). Sends push reminders for payments due in 7, 3, 1, 0 days.
export async function GET(request: Request) {
  // Protect the endpoint: Vercel cron sends Authorization: Bearer CRON_SECRET
  const auth = request.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'Missing server config' }, { status: 500 })
  }

  webpush.setVapidDetails(
    'mailto:ishlokchavan@gmail.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY
  )

  // Service role: bypasses RLS — scoped strictly to reminder lookups
  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const today = new Date()
  const targets = [0, 1, 3, 7].map(d => {
    const dt = new Date(today)
    dt.setDate(dt.getDate() + d)
    return { days: d, date: dt.toISOString().slice(0, 10) }
  })

  let sent = 0
  for (const t of targets) {
    const { data: milestones } = await db
      .from('payment_milestones')
      .select('id, label, amount, due_date, user_id, property_id, properties(project_name)')
      .eq('status', 'due')
      .eq('due_date', t.date)

    for (const m of milestones || []) {
      const { data: subs } = await db
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', m.user_id)

      const project = (m.properties as unknown as { project_name: string } | null)?.project_name || 'Property'
      const amount = `AED ${Number(m.amount).toLocaleString()}`
      const when = t.days === 0 ? 'due TODAY' : t.days === 1 ? 'due tomorrow' : `due in ${t.days} days`

      for (const sub of subs || []) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({
              title: `${project} — payment ${when}`,
              body: `${m.label}: ${amount}`,
              url: '/dashboard',
            })
          )
          sent++
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) {
            await db.from('push_subscriptions').delete().eq('id', sub.id) // expired sub
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: true, sent })
}
