'use client'

import { useState } from 'react'

/** Copy text to the clipboard and flash a `copied` flag for `ms` milliseconds. */
export function useCopied(ms = 1500) {
  const [copied, setCopied] = useState(false)
  const copy = (text: string) => {
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), ms)
  }
  return { copied, copy }
}
