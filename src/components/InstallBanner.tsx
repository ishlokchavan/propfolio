'use client'

import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallBanner() {
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Already installed (standalone mode)? Never show.
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true
    if (standalone) return
    // Dismissed recently? Stay quiet for 3 days.
    const dismissed = localStorage.getItem('pf_install_dismissed')
    if (dismissed && Date.now() - Number(dismissed) < 3 * 24 * 3600 * 1000) return

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIsIOS(ios)

    if (ios) {
      setShow(true) // iOS: instructional banner (Apple allows nothing else)
    } else {
      // Android/desktop Chrome: capture the real install prompt
      const handler = (e: Event) => {
        e.preventDefault()
        setDeferredPrompt(e as BeforeInstallPromptEvent)
        setShow(true)
      }
      window.addEventListener('beforeinstallprompt', handler)
      return () => window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  function dismiss() {
    localStorage.setItem('pf_install_dismissed', String(Date.now()))
    setShow(false)
  }

  async function install() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') setShow(false)
    setDeferredPrompt(null)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-20 lg:bottom-6 left-4 right-4 lg:left-auto lg:right-6 lg:w-96 z-50 p-4 rounded-2xl shadow-2xl anim-in"
      style={{ background: 'var(--surface)', border: '1px solid var(--hero-border)' }}>
      <div className="flex items-start gap-3">
        <img src="/icon-192.png" alt="" className="w-11 h-11 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold" style={{ color: 'var(--text)' }}>Install Propfolio</p>
          {isIOS ? (
            <p className="text-[12px] mt-1 leading-relaxed" style={{ color: 'var(--text3)' }}>
              Tap <ShareIcon /> <strong>Share</strong>, then <strong>&ldquo;Add to Home Screen&rdquo;</strong> — full-screen app, push reminders, instant access.
            </p>
          ) : (
            <p className="text-[12px] mt-1" style={{ color: 'var(--text3)' }}>
              Get the full-screen app with payment reminders.
            </p>
          )}
          {!isIOS && (
            <button onClick={install}
              className="mt-2.5 px-5 py-2 rounded-xl text-[13px] font-bold active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white' }}>
              Install
            </button>
          )}
        </div>
        <button onClick={dismiss} className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'var(--surface2)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

function ShareIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: '-2px' }}>
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
      <polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
    </svg>
  )
}
