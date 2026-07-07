'use client'

import { useEffect } from 'react'
import { useThemeStore } from '@/stores/theme'

export function ThemeSync() {
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    // Theme switching temporarily disabled — force light mode regardless of the
    // stored preference (overrides any persisted 'dark'). Restore the block
    // below to re-enable dark mode.
    root.classList.remove('dark')
    // if (theme === 'dark') {
    //   root.classList.add('dark')
    // } else {
    //   root.classList.remove('dark')
    // }
  }, [theme])

  return null
}
