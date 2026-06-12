import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 300 // 5 min for Vercel Pro, 60s hobby

// Developer-related search query for Gmail
const GMAIL_QUERY = [
  'from:(damac.com OR emaar.ae OR emaar.com OR sobharealty.com OR arada.com',
  'OR nakheel.com OR meraas.ae OR aldar.com OR azizidevelopments.com',
  'OR danubeproperties.com OR binghatti.com OR ellingtonproperties.ae',
  'OR samana-developers.com OR prescott.ae OR tigergroup.ae OR selectgroup.ae)',
  'OR subject:("payment plan" OR "booking confirmation" OR "statement of account"',
  'OR "SPA" OR "sales purchase agreement" OR "payment reminder" OR "installment"',
  'OR "handover" OR "oqood" OR "DLD" OR "unit reservation")',
].join(' ')

interface ParsedProperty {
  project_name: string
  developer: string
  unit_number: string | null
  property_type: string | null
  location: string | null
  emirate: string
  total_value: number
  paid_amount: number
  handover_date: string | null
  ownership_names: string[]
  milestones: Array<{
    label: string
    amount: number
    due_date: string | null
    due_label: string | null
    status: 'paid' | 'due' | 'future'
  }>
  confidence: number
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { accountId } = await request.json()

  // Get the email account with its token
  const { data: account } = await supabase
    .from('email_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', user.id)
    .single()

  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  if (!account.access_token) {
    return NextResponse.json({
      error: 'token_expired',
      message: 'Email access token expired. Please sign out and sign in again to refresh access.',
    }, { status: 401 })
  }

  await supabase.from('email_accounts').update({ sync_status: 'syncing' }).eq('id', accountId)

  try {
    const log: Array<{ message: string; type: string }> = []

    // ── STEP 1: Search Gmail for developer emails ──
    log.push({ message: 'Searching inbox for developer emails...', type: 'info' })

    const searchRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(GMAIL_QUERY)}&maxResults=100`,
      { headers: { Authorization: `Bearer ${account.access_token}` } }
    )

    if (!searchRes.ok) {
      const errBody = await searchRes.text()
      if (searchRes.status === 401) {
        await supabase.from('email_accounts').update({ sync_status: 'error' }).eq('id', accountId)
        return NextResponse.json({
          error: 'token_expired',
          message: 'Gmail access expired. Sign out and back in to reconnect.',
        }, { status: 401 })
      }
      throw new Error(`Gmail search failed: ${searchRes.status} ${errBody.slice(0, 200)}`)
    }

    const searchData = await searchRes.json()
    const messageIds: string[] = (searchData.messages || []).map((m: { id: string }) => m.id)
    log.push({ message: `Found ${messageIds.length} developer-related emails`, type: 'found' })

    if (messageIds.length === 0) {
      await supabase.from('email_accounts').update({
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
        emails_scanned: 0,
      }).eq('id', accountId)
      return NextResponse.json({ properties: [], log, emailsScanned: 0 })
    }

    // ── STEP 2: Fetch email contents (cap at 60 to stay within time limits) ──
    const fetchIds = messageIds.slice(0, 60)
    const emails: Array<{ id: string; subject: string; from: string; date: string; body: string }> = []

    for (const batch of chunk(fetchIds, 10)) {
      const results = await Promise.all(
        batch.map(async (id) => {
          const res = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
            { headers: { Authorization: `Bearer ${account.access_token}` } }
          )
          if (!res.ok) return null
          return res.json()
        })
      )

      for (const msg of results) {
        if (!msg) continue
        const headers = msg.payload?.headers || []
        const getHeader = (name: string) =>
          headers.find((h: { name: string }) => h.name.toLowerCase() === name.toLowerCase())?.value || ''
        emails.push({
          id: msg.id,
          subject: getHeader('Subject'),
          from: getHeader('From'),
          date: getHeader('Date'),
          body: extractBody(msg.payload).slice(0, 3000), // cap per-email body
        })
      }
    }

    log.push({ message: `Reading ${emails.length} emails in detail...`, type: 'processing' })

    // ── STEP 3: Parse with Claude ──
    log.push({ message: 'Extracting properties and payment plans with AI...', type: 'processing' })

    const emailDigest = emails.map((e, i) =>
      `--- EMAIL ${i + 1} (id: ${e.id}) ---\nFrom: ${e.from}\nSubject: ${e.subject}\nDate: ${e.date}\nBody: ${e.body}`
    ).join('\n\n')

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        messages: [{
          role: 'user',
          content: `You are an expert at extracting UAE real estate property data from developer emails.

Below are emails from a property buyer's inbox. Extract every distinct PROPERTY the user has purchased (off-plan or ready). For each property, extract the payment plan milestones.

Rules:
- Each unique unit = one property. The same project can have multiple units.
- Amounts in AED. Parse "1.85M" as 1850000, "185,000" as 185000.
- Milestone status: "paid" if email confirms payment received, "due" if reminder/upcoming within context, "future" otherwise.
- due_date in YYYY-MM-DD format if an exact date exists, otherwise null with due_label like "Q4 2026".
- confidence: 0.0-1.0 how certain you are this is a real owned property (not marketing spam).
- SKIP marketing/promotional emails. Only properties with booking confirmations, SPAs, payment plans, receipts, or statements.
- paid_amount = sum of milestones with status "paid".

Respond ONLY with valid JSON, no markdown fences, in this exact shape:
{"properties": [{"project_name": "...", "developer": "...", "unit_number": "..." or null, "property_type": "Apartment|Villa|Townhouse" or null, "location": "..." or null, "emirate": "Dubai", "total_value": 0, "paid_amount": 0, "handover_date": "Q4 2026" or null, "ownership_names": [], "milestones": [{"label": "...", "amount": 0, "due_date": "YYYY-MM-DD" or null, "due_label": "..." or null, "status": "paid|due|future"}], "confidence": 0.9}]}

If no real properties found, respond: {"properties": []}

EMAILS:
${emailDigest}`,
        }],
      }),
    })

    if (!claudeRes.ok) {
      const errText = await claudeRes.text()
      throw new Error(`AI parsing failed: ${claudeRes.status} ${errText.slice(0, 200)}`)
    }

    const claudeData = await claudeRes.json()
    const rawText = (claudeData.content || [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('')
      .replace(/```json|```/g, '')
      .trim()

    let parsed: { properties: ParsedProperty[] }
    try {
      parsed = JSON.parse(rawText)
    } catch {
      throw new Error('AI returned unparseable response')
    }

    const properties = (parsed.properties || []).filter(p => p.confidence >= 0.5)
    log.push({ message: `Identified ${properties.length} properties`, type: 'found' })

    // ── STEP 4: Insert into database ──
    const inserted = []
    for (const p of properties) {
      // Skip if this property already exists for the user (same project + unit)
      const { data: existing } = await supabase
        .from('properties')
        .select('id')
        .eq('user_id', user.id)
        .eq('project_name', p.project_name)
        .eq('unit_number', p.unit_number || '')
        .maybeSingle()

      if (existing) continue

      const { data: prop, error: propErr } = await supabase
        .from('properties')
        .insert({
          user_id: user.id,
          email_account_id: accountId,
          project_name: p.project_name,
          developer: p.developer,
          unit_number: p.unit_number,
          property_type: p.property_type,
          location: p.location,
          emirate: p.emirate || 'Dubai',
          total_value: p.total_value,
          paid_amount: p.paid_amount,
          handover_date: p.handover_date,
          ownership_names: p.ownership_names,
          ai_confidence: p.confidence,
        })
        .select()
        .single()

      if (propErr || !prop) continue

      if (p.milestones?.length) {
        await supabase.from('payment_milestones').insert(
          p.milestones.map(m => ({
            property_id: prop.id,
            user_id: user.id,
            label: m.label,
            amount: m.amount,
            due_date: m.due_date,
            due_label: m.due_label,
            status: m.status,
          }))
        )
      }

      inserted.push(prop)
      log.push({ message: `✓ ${p.project_name} — ${p.developer}`, type: 'found' })
    }

    // ── STEP 5: Update sync status ──
    await supabase.from('email_accounts').update({
      sync_status: 'synced',
      last_synced_at: new Date().toISOString(),
      emails_scanned: messageIds.length,
    }).eq('id', accountId)

    log.push({ message: `Portfolio updated — ${inserted.length} new properties added`, type: 'found' })

    return NextResponse.json({
      properties: inserted,
      log,
      emailsScanned: messageIds.length,
      propertiesFound: inserted.length,
    })
  } catch (err) {
    await supabase.from('email_accounts').update({ sync_status: 'error' }).eq('id', accountId)
    const message = err instanceof Error ? err.message : 'Sync failed'
    return NextResponse.json({ error: 'sync_failed', message }, { status: 500 })
  }
}

// ── Helpers ──

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

interface GmailPart {
  mimeType?: string
  body?: { data?: string }
  parts?: GmailPart[]
}

function extractBody(payload: GmailPart): string {
  if (!payload) return ''
  // Prefer text/plain
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }
  if (payload.parts) {
    // Try text/plain first
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data)
      }
    }
    // Fall back to HTML, stripped
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return stripHtml(decodeBase64Url(part.body.data))
      }
      // Nested multiparts
      if (part.parts) {
        const nested = extractBody(part)
        if (nested) return nested
      }
    }
  }
  if (payload.body?.data) {
    const raw = decodeBase64Url(payload.body.data)
    return payload.mimeType === 'text/html' ? stripHtml(raw) : raw
  }
  return ''
}

function decodeBase64Url(data: string): string {
  try {
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
  } catch {
    return ''
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}
