import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

const BATCH_SIZE = 16
const MAX_EMAILS = 200
const MAX_PDFS_PER_BATCH = 2
const MAX_PDF_BYTES = 4 * 1024 * 1024

const GMAIL_QUERY = [
  'from:(damac.com OR emaar.ae OR emaar.com OR sobharealty.com OR arada.com',
  'OR nakheel.com OR meraas.ae OR aldar.com OR azizidevelopments.com',
  'OR danubeproperties.com OR binghatti.com OR ellingtonproperties.ae',
  'OR samana-developers.com OR prescott.ae OR ayat.ae OR tigergroup.ae OR selectgroup.ae',
  'OR oqood.ae OR dubailand.gov.ae)',
  'OR subject:("payment plan" OR "booking confirmation" OR "statement of account"',
  'OR "SPA" OR "sales purchase agreement" OR "payment reminder" OR "payment receipt"',
  'OR "installment" OR "handover" OR "oqood" OR "unit reservation" OR "payment received")',
  // Full-text terms so FORWARDED developer emails (sender lost) still match on body content
  'OR "statement of account" OR "payment plan" OR "booking confirmation"',
  'OR "sales purchase agreement" OR "oqood" OR "unit reservation"',
].join(' ')

const GRAPH_SEARCH = '"payment plan" OR "booking confirmation" OR "statement of account" OR "payment receipt" OR installment OR handover OR oqood OR damac OR emaar OR sobha OR arada OR nakheel OR aldar'


interface ParsedMilestone {
  label: string
  amount: number
  due_date: string | null
  due_label: string | null
  status: 'paid' | 'due' | 'future'
}

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
  milestones: ParsedMilestone[]
  confidence: number
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { accountId, action } = body

  const { data: account } = await supabase
    .from('email_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', user.id)
    .single()

  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  // Auto-refresh expired Google tokens using the stored refresh token
  if (account.provider === 'google' && account.refresh_token) {
    const expired = !account.token_expires_at || new Date(account.token_expires_at) < new Date(Date.now() + 5 * 60 * 1000)
    if (expired && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      const refreshed = await refreshGoogleToken(account.refresh_token)
      if (refreshed) {
        account.access_token = refreshed.access_token
        await supabase.from('email_accounts').update({
          access_token: refreshed.access_token,
          token_expires_at: new Date(Date.now() + (refreshed.expires_in - 300) * 1000).toISOString(),
        }).eq('id', account.id)
      }
    }
  }

  if (!account.access_token) {
    return NextResponse.json({ error: 'token_expired', message: 'Email access expired. Sign out and back in to reconnect.' }, { status: 401 })
  }

  try {
    if (action === 'start') return await startSync(supabase, user.id, account)
    if (action === 'process') return await processBatch(supabase, user.id, account, body.jobId)
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    if (message.includes('401') || message.toLowerCase().includes('invalid credentials')) {
      return NextResponse.json({ error: 'token_expired', message: 'Gmail access expired. Sign out and back in.' }, { status: 401 })
    }
    return NextResponse.json({ error: 'sync_failed', message }, { status: 500 })
  }
}

// ── PHASE 1: search inbox, create job ──
async function startSync(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, account: { id: string; access_token: string; provider: string; last_synced_at?: string | null }) {
  // Incremental: after the first full scan, only fetch emails newer than last sync
  const since: string | null = account.last_synced_at || null
  const messageIds = (account.provider === 'microsoft'
    ? await searchOutlook(account.access_token, since)
    : await searchGmail(account.access_token, since)
  ).slice(0, MAX_EMAILS)

  await supabase.from('email_accounts').update({ sync_status: 'syncing' }).eq('id', account.id)

  const { data: job, error } = await supabase
    .from('sync_jobs')
    .insert({
      user_id: userId,
      email_account_id: account.id,
      status: 'scanning',
      progress: 0,
      emails_scanned: messageIds.length,
      payload: { messageIds, cursor: 0 },
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error || !job) throw new Error('Could not create sync job')

  return NextResponse.json({
    jobId: job.id,
    totalEmails: messageIds.length,
    log: [{
      message: since
        ? `Found ${messageIds.length} new emails since last sync`
        : `Found ${messageIds.length} developer-related emails`,
      type: 'found',
    }],
  })
}

// ── PHASE 2: process one batch ──
async function processBatch(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, account: { id: string; access_token: string; provider: string }, jobId: string) {
  const { data: job } = await supabase
    .from('sync_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', userId)
    .single()
  if (!job) throw new Error('Job not found')

  const messageIds: string[] = job.payload?.messageIds || []
  const cursor: number = job.payload?.cursor || 0
  const batch = messageIds.slice(cursor, cursor + BATCH_SIZE)
  const log: Array<{ message: string; type: string }> = []

  if (batch.length === 0) {
    await finishJob(supabase, job, account.id)
    return NextResponse.json({ done: true, progress: 100, propertiesFound: job.properties_found, log: [{ message: `Scan complete — ${job.properties_found} properties in portfolio`, type: 'found' }] })
  }

  // Fetch emails (provider-aware); PDFs downloaded only for triage survivors
  const allEmails = account.provider === 'microsoft'
    ? await fetchOutlookBatch(account.access_token, batch)
    : await fetchGmailBatch(account.access_token, batch)

  // STAGE 1 — Haiku triage: keep only ownership documents, discard marketing
  let emails: EmailItem[]
  try {
    const keep = await triageEmails(allEmails)
    emails = allEmails.filter((_, i) => keep[i])
  } catch (err) {
    const e = err as Error & { rateLimited?: boolean; retryAfter?: number }
    if (e.rateLimited) {
      return NextResponse.json({
        done: false, rateLimited: true, retryAfter: e.retryAfter || 60,
        progress: Math.min(99, Math.round((cursor / messageIds.length) * 100)),
        propertiesFound: job.properties_found || 0,
        log: [{ message: `AI rate limit — pausing ${e.retryAfter || 60}s, then continuing...`, type: 'info' }],
      })
    }
    throw err
  }

  if (allEmails.length - emails.length > 0) {
    log.push({ message: `Filtered out ${allEmails.length - emails.length} marketing emails`, type: 'info' })
  }

  // Nothing real in this batch — advance cursor cheaply, no heavyweight parse
  if (emails.length === 0) {
    const newCursorEmpty = cursor + batch.length
    const progressEmpty = Math.min(99, Math.round((newCursorEmpty / messageIds.length) * 100))
    await supabase.from('sync_jobs').update({
      payload: { messageIds, cursor: newCursorEmpty }, progress: progressEmpty, status: 'parsing',
    }).eq('id', jobId)
    log.push({ message: `Processed ${Math.min(newCursorEmpty, messageIds.length)}/${messageIds.length} emails`, type: 'info' })
    return NextResponse.json({ done: false, progress: progressEmpty, propertiesFound: job.properties_found || 0, log })
  }

  // STAGE 2 — download PDFs only for surviving emails
  const usablePdfs: Array<{ name: string; data: string }> = []
  let lockedCount = 0
  for (const em of emails) {
    if (usablePdfs.length >= MAX_PDFS_PER_BATCH) break
    if (account.provider === 'microsoft') {
      if (em.pdfRefs.length > 0) {
        const got = await downloadOutlookPdfs(account.access_token, em.pdfRefs[0].msgId, MAX_PDFS_PER_BATCH - usablePdfs.length)
        for (const pdf of got) {
          if (isPdfEncrypted(pdf.data)) { lockedCount++; continue }
          usablePdfs.push(pdf)
        }
      }
    } else {
      for (const ref of em.pdfRefs) {
        if (usablePdfs.length >= MAX_PDFS_PER_BATCH) break
        const pdf = await downloadGmailPdf(account.access_token, ref)
        if (!pdf) continue
        if (isPdfEncrypted(pdf.data)) { lockedCount++; continue }
        usablePdfs.push(pdf)
      }
    }
  }
  if (lockedCount > 0) {
    log.push({ message: `Skipped ${lockedCount} password-protected PDF${lockedCount > 1 ? 's' : ''}`, type: 'info' })
  }

  // STAGE 3 — Sonnet extraction on real documents only
  let parsed: ParsedProperty[]
  try {
    parsed = await parseWithClaude(emails, usablePdfs)
  } catch (err) {
    const e = err as Error & { rateLimited?: boolean; retryAfter?: number }
    if (e.rateLimited) {
      // Cursor NOT advanced — client waits and retries this same batch
      return NextResponse.json({
        done: false,
        rateLimited: true,
        retryAfter: e.retryAfter || 60,
        progress: Math.min(99, Math.round((cursor / messageIds.length) * 100)),
        propertiesFound: job.properties_found || 0,
        log: [{ message: `AI rate limit — pausing ${e.retryAfter || 60}s, then continuing...`, type: 'info' }],
      })
    }
    throw err
  }
  const accepted = parsed.filter(p => p.confidence >= 0.5 && p.total_value > 0)

  // Merge into DB
  let newCount = 0
  for (const p of accepted) {
    const merged = await mergeProperty(supabase, userId, account.id, p)
    if (merged === 'inserted') {
      newCount++
      log.push({ message: `✓ ${p.project_name} — ${p.developer}`, type: 'found' })
    } else if (merged === 'updated') {
      log.push({ message: `↻ Updated ${p.project_name}`, type: 'processing' })
    }
  }

  const newCursor = cursor + batch.length
  const progress = Math.min(99, Math.round((newCursor / messageIds.length) * 100))
  const totalFound = (job.properties_found || 0) + newCount

  await supabase.from('sync_jobs').update({
    payload: { messageIds, cursor: newCursor },
    progress,
    properties_found: totalFound,
    status: 'parsing',
  }).eq('id', jobId)

  if (usablePdfs.length > 0) log.push({ message: `Read ${usablePdfs.length} PDF attachment${usablePdfs.length > 1 ? 's' : ''}`, type: 'processing' })
  log.push({ message: `Processed ${Math.min(newCursor, messageIds.length)}/${messageIds.length} emails`, type: 'info' })

  return NextResponse.json({ done: false, progress, propertiesFound: totalFound, log })
}

async function finishJob(supabase: Awaited<ReturnType<typeof createClient>>, job: { id: string; email_account_id: string; emails_scanned: number }, accountId: string) {
  await supabase.from('sync_jobs').update({ status: 'done', progress: 100, completed_at: new Date().toISOString() }).eq('id', job.id)
  await supabase.from('email_accounts').update({
    sync_status: 'synced',
    last_synced_at: new Date().toISOString(),
    emails_scanned: job.emails_scanned,
  }).eq('id', accountId)
}


// ── Stage 1: triage with Gemini Flash (free tier) ──
async function triageEmails(emails: EmailItem[]): Promise<boolean[]> {
  if (emails.length === 0) return []
  const digest = emails.map((e, i) =>
    `${i + 1}. From: ${e.from} | Subject: ${e.subject} | Snippet: ${e.body.slice(0, 200)}`
  ).join('\n')

  const prompt = `You are helping filter a UAE property buyer's inbox. Which of these emails are OWNERSHIP documents — booking confirmations, SPAs, payment plans, payment receipts, payment reminders, statements of account, handover notices for a specific purchased unit? Exclude marketing emails, newsletters, launch announcements, and price lists.

Respond ONLY with a JSON array of the email numbers that ARE ownership documents, e.g. [2,5,9]. If none match: []

${digest}`

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`
    const res = await fetch(
      geminiUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 256 },
        }),
      }
    )

    if (!res.ok) {
      // Gemini failure — fall back to treating all emails as relevant rather than blocking
      console.warn('[triage] Gemini error', res.status)
      return emails.map(() => true)
    }

    const data = await res.json()
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const nums: number[] = JSON.parse(cleaned)
    const set = new Set(nums)
    return emails.map((_, i) => set.has(i + 1))
  } catch {
    // On any parse/network failure, keep all emails (safe default)
    return emails.map(() => true)
  }
}

// ── Claude parsing with PDF support ──
async function parseWithClaude(
  emails: Array<{ subject: string; from: string; date: string; body: string }>,
  pdfs: Array<{ name: string; data: string }>
): Promise<ParsedProperty[]> {
  const digest = emails.map((e, i) =>
    `--- EMAIL ${i + 1} ---\nFrom: ${e.from}\nSubject: ${e.subject}\nDate: ${e.date}\nBody: ${e.body}`
  ).join('\n\n')

  const content: Array<Record<string, unknown>> = []
  for (const pdf of pdfs) {
    content.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: pdf.data },
    })
  }
  content.push({
    type: 'text',
    text: `You are an expert at extracting UAE real estate ownership data from developer emails and attached PDF documents (payment plans, SOAs, booking forms, receipts).

Today's date: ${new Date().toISOString().slice(0, 10)}

Extract every distinct PROPERTY this buyer OWNS from the emails below and any attached PDFs. PDFs are the highest-quality source — payment plan tables in PDFs override amounts mentioned in email text.

Rules:
- One unique unit = one property. Merge information about the same unit from multiple emails into ONE entry.
- Amounts in AED as plain numbers: "1.85M" → 1850000, "AED 185,000" → 185000.
- Milestone status relative to today: "paid" if a receipt/confirmation exists OR the due date passed and a later payment was made; "due" if due within 60 days or overdue with no payment evidence; "future" otherwise.
- due_date as YYYY-MM-DD when exact, else null with due_label ("Q4 2026", "On Completion").
- Include DLD fees / admin fees / Oqood charges as milestones if they appear in payment plans.
- paid_amount = sum of milestones marked paid.
- SKIP marketing, newsletters, price lists, launch announcements — only properties with booking confirmations, SPAs, payment plans, receipts, or statements of account.
- confidence 0.0-1.0 that this is a genuinely owned unit.

Respond ONLY with valid JSON, no markdown fences:
{"properties": [{"project_name": "...", "developer": "...", "unit_number": "..." or null, "property_type": "Apartment 2BR" or null, "location": "..." or null, "emirate": "Dubai", "total_value": 0, "paid_amount": 0, "handover_date": "..." or null, "ownership_names": [], "milestones": [{"label": "...", "amount": 0, "due_date": null, "due_label": null, "status": "paid"}], "confidence": 0.9}]}

If none: {"properties": []}

EMAILS:
${digest}`,
  })

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content }],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    // A bad/locked PDF slipped through — retry this batch without attachments rather than failing
    if (res.status === 400 && pdfs.length > 0 && /pdf/i.test(errText)) {
      return parseWithClaude(emails, [])
    }
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') || '60', 10)
      const e = new Error('rate_limited') as Error & { rateLimited: boolean; retryAfter: number }
      e.rateLimited = true
      e.retryAfter = Math.min(Math.max(retryAfter, 15), 90)
      throw e
    }
    throw new Error(`AI parsing failed: ${res.status} ${errText.slice(0, 150)}`)
  }
  const data = await res.json()
  const raw = (data.content || [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('')
    .replace(/```json|```/g, '')
    .trim()

  try {
    const parsed = JSON.parse(raw)
    return parsed.properties || []
  } catch {
    return []
  }
}

// ── Merge logic: same project+unit updates, never duplicates ──
async function mergeProperty(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  accountId: string,
  p: ParsedProperty
): Promise<'inserted' | 'updated' | 'skipped'> {
  const { data: existing } = await supabase
    .from('properties')
    .select('id, total_value, paid_amount, payment_milestones(id, label, amount)')
    .eq('user_id', userId)
    .ilike('project_name', p.project_name)
    .maybeSingle()

  if (existing) {
    // Update financials if the new parse knows more
    const updates: Record<string, unknown> = {}
    if (p.paid_amount > (existing.paid_amount || 0)) updates.paid_amount = p.paid_amount
    if (p.total_value > 0 && (existing.total_value || 0) === 0) updates.total_value = p.total_value
    if (Object.keys(updates).length) {
      await supabase.from('properties').update(updates).eq('id', existing.id)
    }

    // Append only milestones we don't already have (match label+amount)
    const have = new Set((existing.payment_milestones || []).map((m: { label: string; amount: number }) => `${m.label.toLowerCase()}|${Math.round(m.amount)}`))
    const fresh = (p.milestones || []).filter(m => !have.has(`${m.label.toLowerCase()}|${Math.round(m.amount)}`))
    if (fresh.length) {
      await supabase.from('payment_milestones').insert(fresh.map(m => ({
        property_id: existing.id, user_id: userId,
        label: m.label, amount: m.amount, due_date: m.due_date, due_label: m.due_label, status: m.status,
      })))
      return 'updated'
    }
    return Object.keys(updates).length ? 'updated' : 'skipped'
  }

  const { data: prop, error } = await supabase.from('properties').insert({
    user_id: userId, email_account_id: accountId,
    project_name: p.project_name, developer: p.developer, unit_number: p.unit_number,
    property_type: p.property_type, location: p.location, emirate: p.emirate || 'Dubai',
    total_value: p.total_value, paid_amount: p.paid_amount, handover_date: p.handover_date,
    ownership_names: p.ownership_names, ai_confidence: p.confidence,
  }).select().single()

  if (error || !prop) return 'skipped'

  if (p.milestones?.length) {
    await supabase.from('payment_milestones').insert(p.milestones.map(m => ({
      property_id: prop.id, user_id: userId,
      label: m.label, amount: m.amount, due_date: m.due_date, due_label: m.due_label, status: m.status,
    })))
  }
  return 'inserted'
}


function isPdfEncrypted(base64Data: string): boolean {
  try {
    return Buffer.from(base64Data, 'base64').includes('/Encrypt')
  } catch {
    return true // unreadable — treat as unusable
  }
}

async function refreshGoogleToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// ── Provider adapters ──

async function searchGmail(token: string, since?: string | null): Promise<string[]> {
  const ids: string[] = []
  let pageToken: string | undefined
  while (ids.length < MAX_EMAILS) {
    const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages')
    const sinceFilter = since ? ` after:${new Date(since).toISOString().slice(0, 10).replace(/-/g, '/')}` : ''
    url.searchParams.set('q', `(${GMAIL_QUERY})${sinceFilter}`)
    url.searchParams.set('maxResults', '100')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`Gmail search failed: ${res.status} ${(await res.text()).slice(0, 150)}`)
    const data = await res.json()
    ids.push(...(data.messages || []).map((m: { id: string }) => m.id))
    pageToken = data.nextPageToken
    if (!pageToken) break
  }
  return ids
}

async function searchOutlook(token: string, since?: string | null): Promise<string[]> {
  const ids: string[] = []
  const search = since
    ? `(${GRAPH_SEARCH}) AND received>=${new Date(since).toISOString().slice(0, 10)}`
    : GRAPH_SEARCH
  let url: string | null =
    `https://graph.microsoft.com/v1.0/me/messages?$search=${encodeURIComponent(search)}&$top=100&$select=id`
  while (url && ids.length < MAX_EMAILS) {
    const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`Outlook search failed: ${res.status} ${(await res.text()).slice(0, 150)}`)
    const data = await res.json()
    ids.push(...(data.value || []).map((m: { id: string }) => m.id))
    url = data['@odata.nextLink'] || null
  }
  return ids
}

interface EmailItem {
  subject: string
  from: string
  date: string
  body: string
  pdfRefs: Array<{ msgId: string; attachmentId: string; filename: string; size: number }>
}

async function fetchGmailBatch(token: string, batch: string[]): Promise<EmailItem[]> {
  const results = await Promise.all(batch.map(async (id) => {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      { headers: { Authorization: `Bearer ${token}` } })
    return res.ok ? res.json() : null
  }))

  const emails: EmailItem[] = []
  for (const msg of results) {
    if (!msg) continue
    const headers = msg.payload?.headers || []
    const h = (n: string) => headers.find((x: { name: string }) => x.name.toLowerCase() === n.toLowerCase())?.value || ''
    emails.push({
      subject: h('Subject'), from: h('From'), date: h('Date'),
      body: extractBody(msg.payload).slice(0, 2000),
      pdfRefs: findPdfParts(msg.payload)
        .filter(a => a.size <= MAX_PDF_BYTES)
        .map(a => ({ msgId: msg.id, attachmentId: a.attachmentId, filename: a.filename, size: a.size })),
    })
  }
  return emails
}

async function downloadGmailPdf(token: string, ref: { msgId: string; attachmentId: string; filename: string }) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${ref.msgId}/attachments/${ref.attachmentId}`,
    { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return null
  const data = await res.json()
  if (!data.data) return null
  return { name: ref.filename, data: data.data.replace(/-/g, '+').replace(/_/g, '/') }
}

async function fetchOutlookBatch(token: string, batch: string[]): Promise<EmailItem[]> {
  const results = await Promise.all(batch.map(async (id) => {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${id}?$select=subject,from,receivedDateTime,body,hasAttachments`,
      { headers: { Authorization: `Bearer ${token}` } })
    return res.ok ? res.json() : null
  }))

  const emails: EmailItem[] = []
  for (const msg of results) {
    if (!msg) continue
    const bodyText = msg.body?.contentType === 'html' ? stripHtml(msg.body.content || '') : (msg.body?.content || '')
    emails.push({
      subject: msg.subject || '',
      from: msg.from?.emailAddress?.address || '',
      date: msg.receivedDateTime || '',
      body: bodyText.slice(0, 2000),
      pdfRefs: msg.hasAttachments ? [{ msgId: msg.id, attachmentId: '', filename: '', size: 0 }] : [],
    })
  }
  return emails
}

async function downloadOutlookPdfs(token: string, msgId: string, max: number) {
  const out: Array<{ name: string; data: string }> = []
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${msgId}/attachments`,
    { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return out
  const data = await res.json()
  for (const att of data.value || []) {
    if (out.length >= max) break
    if (att.contentType === 'application/pdf' && att.contentBytes && (att.size || 0) <= MAX_PDF_BYTES) {
      out.push({ name: att.name, data: att.contentBytes })
    }
  }
  return out
}

// ── Gmail helpers ──
interface GmailPart {
  mimeType?: string
  filename?: string
  body?: { data?: string; attachmentId?: string; size?: number }
  parts?: GmailPart[]
}

function findPdfParts(payload: GmailPart, out: Array<{ filename: string; attachmentId: string; size: number }> = []): Array<{ filename: string; attachmentId: string; size: number }> {
  if (!payload) return out
  if (payload.filename?.toLowerCase().endsWith('.pdf') && payload.body?.attachmentId) {
    out.push({ filename: payload.filename, attachmentId: payload.body.attachmentId, size: payload.body.size || 0 })
  }
  for (const part of payload.parts || []) findPdfParts(part, out)
  return out
}

function extractBody(payload: GmailPart): string {
  if (!payload) return ''
  if (payload.mimeType === 'text/plain' && payload.body?.data) return decode(payload.body.data)
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) return decode(part.body.data)
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) return stripHtml(decode(part.body.data))
      if (part.parts) { const n = extractBody(part); if (n) return n }
    }
  }
  if (payload.body?.data) {
    const raw = decode(payload.body.data)
    return payload.mimeType === 'text/html' ? stripHtml(raw) : raw
  }
  return ''
}

function decode(data: string): string {
  try { return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8') } catch { return '' }
}

function stripHtml(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
}
