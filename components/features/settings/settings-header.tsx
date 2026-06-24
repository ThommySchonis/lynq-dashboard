'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  Fragment,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import SettingsSidebar from '@/components/features/settings/settings-sidebar'

/**
 * Per-page settings header (Figma head bar, node 831-26745). The full-width
 * bar lives in the settings layout and spans over the sidebar. Most pages keep
 * the default "Settings" title; a page overrides it with <SettingsPageHeader />.
 *
 * A page can also enter "focused" mode by passing `backHref` (+ optional
 * `breadcrumb`): the bar switches to a detail header (back arrow + breadcrumb +
 * 18px title) and the settings sidebar is hidden (Figma Create-macro, 831-26677).
 */

interface HeaderConfig {
  title: string
  description?: string
  actions?: ReactNode
  /** When set, the bar renders the detail (focused) variant and hides the sidebar. */
  backHref?: string
  /** Breadcrumb trail for the detail header, last item is the current page. */
  breadcrumb?: string[]
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

/** Read the current header config — used by the layout shell. */
export function useSettingsHeader(): HeaderConfig {
  return useContext(SettingsHeaderContext)?.header ?? DEFAULT_HEADER
}

/**
 * Settings layout shell: full-width header bar, then the sidebar + content row.
 * In focused mode (header.backHref set) the sidebar is hidden.
 */
export function SettingsShell({ children }: { children: ReactNode }) {
  const { backHref } = useSettingsHeader()
  const focused = !!backHref

  return (
    <div className="flex h-screen flex-col bg-settings-surface">
      <SettingsHeaderBar />
      <div className="flex min-h-0 flex-1">
        {!focused && <SettingsSidebar />}
        <main className="flex-1 overflow-y-auto min-w-0">{children}</main>
      </div>
    </div>
  )
}

/** Full-width section header bar rendered by the settings layout. */
function SettingsHeaderBar() {
  const { title, description, actions, backHref, breadcrumb } = useSettingsHeader()

  // Detail (focused) variant — back arrow + breadcrumb + 18px title.
  if (backHref) {
    return (
      <header className="shrink-0 bg-card border-b border-settings-border px-10 py-5 flex items-center justify-between gap-4">
        {/* Left: back arrow + inline breadcrumb */}
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href={backHref}
            aria-label="Back"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-foreground-2 transition-colors hover:bg-black/[0.04]"
          >
            <ArrowLeft size={22} strokeWidth={1.75} />
          </Link>
          {breadcrumb && breadcrumb.length > 0 && (
            <nav className="flex items-center gap-1.5 text-xs text-foreground-4">
              {breadcrumb.map((crumb, i) => (
                <Fragment key={crumb}>
                  {i > 0 && <span>/</span>}
                  <span className={i === breadcrumb.length - 1 ? 'font-semibold text-foreground-2' : ''}>
                    {crumb}
                  </span>
                </Fragment>
              ))}
            </nav>
          )}
        </div>
        {/* Right: page title */}
        <h1 className="shrink-0 text-lg font-bold leading-tight text-foreground">{title}</h1>
      </header>
    )
  }

  // Standard variant — 22px title + subtitle + optional action.
  return (
    <header className="shrink-0 bg-card border-b border-settings-border px-10 py-5 flex items-center justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-bold leading-tight text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  )
}

/**
 * Declarative header override. Render inside a settings page; resets to the
 * default on unmount. Memoize `actions`/`breadcrumb` in the page to avoid
 * redundant updates.
 */
export function SettingsPageHeader({ title, description, actions, backHref, breadcrumb }: HeaderConfig) {
  const setHeader = useContext(SettingsHeaderContext)?.setHeader

  useEffect(() => {
    setHeader?.({ title, description, actions, backHref, breadcrumb })
    return () => setHeader?.(null)
  }, [setHeader, title, description, actions, backHref, breadcrumb])

  return null
}
