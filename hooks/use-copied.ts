'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Copy text to the clipboard and flash a `copied` flag for `ms` milliseconds.
 * Only flips `copied` once the write actually succeeds, and clears its timer on
 * unmount / re-copy so it never setState's after the component is gone.
 */
export function useCopied(ms = 1500) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const copy = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(false), ms)
      })
      .catch(() => {
        /* clipboard blocked (insecure context / denied) — leave state untouched */
      })
  }

  return { copied, copy }
}
