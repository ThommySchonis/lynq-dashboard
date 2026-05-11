'use client'

import { useEffect } from 'react'
import { useThemeStore } from '@/stores/theme'

export function ThemeSync() {
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  useEffect(() => {
    const saved = document.documentElement.getAttribute('data-theme')
    if (saved && (saved === 'light' || saved === 'dark')) {
      useThemeStore.getState().setTheme(saved)
    }
  }, [])

  return null
}
