'use client'

import { useEffect, useRef, useState } from 'react'

/** Animated number count-up. Eases from 0 (or previous) to target. */
export function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0)
  const fromRef = useRef(0)
  const rafRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const from = fromRef.current
    const start = performance.now()
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const v = from + (target - from) * easeOut(p)
      setValue(v)
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration])

  return value
}

/** Adds a material-style ripple to clicks on the wrapped element. */
export function useRipple() {
  return (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height)
    const ripple = document.createElement('span')
    ripple.className = 'ripple'
    ripple.style.width = ripple.style.height = `${size}px`
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`
    el.appendChild(ripple)
    setTimeout(() => ripple.remove(), 600)
  }
}

/** Reveals children with a fade-up when scrolled into view. */
export function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setShown(true); obs.disconnect() }
    }, { threshold: 0.12 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref} className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(14px)',
        transition: `opacity 0.5s ${delay}ms cubic-bezier(0.22,1,0.36,1), transform 0.5s ${delay}ms cubic-bezier(0.22,1,0.36,1)`,
      }}>
      {children}
    </div>
  )
}
