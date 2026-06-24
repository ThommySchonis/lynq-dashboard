'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

/**
 * Per-page settings header (Figma head bar, node 831-26745). The full-width
 * bar lives in the settings layout and spans over the sidebar. Most pages keep
 * the default "Settings" title; a page can override the title/description and
 * add a right-aligned action (e.g. "Invite user") by rendering
 * <SettingsPageHeader …/> anywhere in its tree.
 */

interface HeaderConfig {
  title: string
  description: string
  actions?: ReactNode
}

const DEFAULT_HEADER: HeaderConfig = {
  title: 'Settings',
  description: 'Workspace, account & preferences',
}

interface HeaderContextValue {
  header: HeaderConfig
  setHeader: (config: HeaderConfig | null) => void
}

const SettingsHeaderContext = createContext<HeaderContextValue | null>(null)

export function SettingsHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeaderState] = useState<HeaderConfig>(DEFAULT_HEADER)

  // Stable setter so a page's effect doesn't re-run on every header change.
  const setHeader = useCallback((config: HeaderConfig | null) => {
    setHeaderState(config ?? DEFAULT_HEADER)
  }, [])

  const value = useMemo(() => ({ header, setHeader }), [header, setHeader])

  return (
    <SettingsHeaderContext.Provider value={value}>
      {children}
    </SettingsHeaderContext.Provider>
  )
}

/** Read the current header config — used by the layout's header bar. */
export function useSettingsHeader(): HeaderConfig {
  return useContext(SettingsHeaderContext)?.header ?? DEFAULT_HEADER
}

/** Full-width section header bar rendered by the settings layout. */
export function SettingsHeaderBar() {
  const { title, description, actions } = useSettingsHeader()
  return (
    <header className="shrink-0 bg-card border-b border-settings-border px-10 py-5 flex items-center justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-bold leading-tight text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  )
}

/**
 * Declarative header override. Render inside a settings page; resets to the
 * default on unmount. `actions` changes identity each render, so memoize it in
 * the page (useMemo) to avoid redundant updates.
 */
export function SettingsPageHeader({ title, description, actions }: HeaderConfig) {
  const setHeader = useContext(SettingsHeaderContext)?.setHeader

  useEffect(() => {
    setHeader?.({ title, description, actions })
    return () => setHeader?.(null)
  }, [setHeader, title, description, actions])

  return null
}
