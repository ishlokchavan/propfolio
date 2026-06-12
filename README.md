# Propfolio

Track all your UAE off-plan property investments in one place. Connect your email — AI builds your portfolio automatically.

**Live:** https://propfolio-nu.vercel.app

## How it works
1. Sign in with Google (Gmail read-only scope)
2. AI scans your inbox for developer emails (DAMAC, Emaar, Sobha, Arada, ...) — two-stage pipeline: Haiku triage → Sonnet extraction, including PDF payment plans
3. Portfolio appears: properties, payment milestones, cashflow, resale NOC eligibility

## Stack
Next.js (App Router) · Supabase (auth + Postgres + RLS) · Anthropic Claude API · Gmail API / Microsoft Graph · Vercel

## Env vars
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=     # server-side only
ANTHROPIC_API_KEY=
GOOGLE_CLIENT_ID=              # for token auto-refresh
GOOGLE_CLIENT_SECRET=
```

## Features
- Email sync (Gmail + Outlook via identity linking), incremental after first scan
- PDF attachment parsing; password-protected PDFs skipped gracefully
- Rate-limit-aware batched pipeline with pause/resume
- Resale NOC threshold tracking
- Dual currency (AED primary + INR/USD/GBP/EUR secondary, live FX, Lakh/Crore notation)
- Yearly cashflow projection
- Due-payment alerts
- PWA: Add to Home Screen on iOS

## Roadmap
Push notifications · multi-user portfolios · WhatsApp digest · per-developer PDF passwords · UAE Pass / DLD integration
