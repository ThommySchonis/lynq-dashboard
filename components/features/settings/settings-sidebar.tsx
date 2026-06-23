'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { visibleSettingsNav, ALL_SETTINGS_ITEMS } from '@/lib/settings-constants'
import { usePermissions } from '@/hooks/use-permissions'

export function SettingsSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { can } = usePermissions()
  const nav = visibleSettingsNav(can)
  const [query, setQuery] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Restrict search to items the current role can actually see.
  const visibleHrefs = new Set(nav.flatMap(g => g.items.map(i => i.href)))
  const filtered = query.trim().length > 0
    ? ALL_SETTINGS_ITEMS.filter(item =>
        visibleHrefs.has(item.href) &&
        item.label.toLowerCase().includes(query.toLowerCase())
      )
    : []

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        searchRef.current && !searchRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setQuery('')
      setDropdownOpen(false)
      ;(e.target as HTMLInputElement).blur()
    }
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    setDropdownOpen(e.target.value.trim().length > 0)
  }

  function handleDropdownItemClick(href: string) {
    setQuery('')
    setDropdownOpen(false)
    router.push(href)
  }

  const personalGroupIndex = nav.findIndex(g => g.label === 'PERSONAL')

  return (
    <aside className="w-[248px] shrink-0 h-full bg-settings-surface border-r border-settings-border flex flex-col">
      {/* Search — sidebar starts directly with the search field (no title), per Figma node 857-15422 */}
      <div className="px-4 pt-5 pb-1 flex-shrink-0">
        <div className="relative" ref={searchRef}>
          {/* Search icon */}
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-4 flex items-center pointer-events-none z-10">
            <Search size={14} strokeWidth={1.75} />
          </span>

          <Input
            type="text"
            placeholder="Search settings…"
            value={query}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => query.trim().length > 0 && setDropdownOpen(true)}
            autoComplete="off"
            className="pl-8 pr-10 py-2 text-[13px] bg-card border-settings-border text-foreground placeholder:text-foreground-4 focus-visible:ring-primary/20 focus-visible:border-primary"
          />

          {/* ⌘K hint badge */}
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-foreground-4 bg-settings-divider rounded-[3px] px-1 leading-[1.6] pointer-events-none">
            ⌘K
          </span>

          {/* Dropdown results */}
          {dropdownOpen && filtered.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-border rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.08)] z-[100] max-h-[280px] overflow-y-auto"
            >
              {filtered.map(item => (
                <div
                  key={item.href}
                  className="flex flex-col gap-px py-[9px] px-3 cursor-pointer text-[13px] text-foreground transition-colors hover:bg-secondary"
                  onMouseDown={() => handleDropdownItemClick(item.href)}
                >
                  <span>{item.label}</span>
                  <span className="text-[10px] text-foreground-4 font-medium tracking-[0.04em]">
                    {item.group}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* No results state */}
          {dropdownOpen && filtered.length === 0 && query.trim().length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-border rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.08)] z-[100]"
            >
              <p className="py-3 px-3 text-[13px] text-foreground-4 text-center">
                No results for &ldquo;{query}&rdquo;
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Nav scroll area */}
      <nav className="flex-1 overflow-y-auto py-2 pb-5 [scrollbar-width:thin] [scrollbar-color:var(--settings-border)_transparent] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-settings-border [&::-webkit-scrollbar-thumb]:rounded-sm">
        {nav.map((group, groupIdx) => (
          <div key={group.label}>
            {groupIdx === personalGroupIndex && (
              <div className="h-px bg-settings-divider mx-4 my-2" />
            )}

            <div className={`px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-4 select-none ${groupIdx === 0 ? 'pt-3' : 'pt-5'}`}>
              {group.label}
            </div>

            {group.items.map(item => (
              <div key={item.href} className="px-2 py-0.5">
                <Link
                  href={item.href}
                  className={[
                    'flex items-center gap-2.5 w-full px-3 py-[9px] rounded-[10px] text-sm no-underline transition-colors',
                    pathname === item.href
                      ? 'bg-accent-soft text-primary font-semibold'
                      : 'text-foreground-2 font-medium hover:bg-black/[0.04] hover:text-foreground',
                    'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-2px]',
                  ].join(' ')}
                >
                  <item.Icon size={16} strokeWidth={1.75} className="shrink-0" />
                  {item.label}
                </Link>
              </div>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}

export default SettingsSidebar
