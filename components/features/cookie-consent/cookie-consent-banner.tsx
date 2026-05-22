'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { hasConsented, setConsent, type ConsentLevel } from '@/lib/cookies/consent'

const PUBLIC_ROUTES = ['/login', '/signup', '/forgot-password']

export function CookieConsentBanner() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (PUBLIC_ROUTES.includes(pathname) && !hasConsented()) {
      setVisible(true)
    } else {
      setVisible(false)
    }
  }, [pathname])

  function handleConsent(level: ConsentLevel) {
    setConsent(level)
    setVisible(false)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-0 inset-x-0 z-50"
        >
          <div className="border-t border-[var(--border)] bg-[var(--card)] shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
            <div className="mx-auto max-w-3xl px-5 py-4 flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-stretch max-sm:text-center">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  We use cookies
                </p>
                <p className="text-xs text-[var(--foreground-3)] mt-0.5">
                  Essential cookies keep the app running. Analytics cookies help us improve.
                </p>
              </div>
              <div className="flex gap-2 shrink-0 max-sm:justify-center">
                <button
                  type="button"
                  onClick={() => handleConsent('essential')}
                  className="px-4 py-2 text-sm rounded-[var(--radius)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition-colors cursor-pointer"
                >
                  Essentials Only
                </button>
                <button
                  type="button"
                  onClick={() => handleConsent('all')}
                  className="px-4 py-2 text-sm rounded-[var(--radius)] bg-[var(--primary)] text-white hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Accept All
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
