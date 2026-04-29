'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const ThemeCtx = createContext({ theme: 'light', toggle: () => {} })
export const useTheme = () => useContext(ThemeCtx)

export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    // Sync with what the anti-flash script already set
    const saved = document.documentElement.getAttribute('data-theme') || 'light'
    setTheme(saved)
  }, [])

  const toggle = () => {
    setTheme(t => {
      const next = t === 'light' ? 'dark' : 'light'
      localStorage.setItem('lynq-theme', next)
      document.documentElement.setAttribute('data-theme', next)
      return next
    })
  }

  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>
}
