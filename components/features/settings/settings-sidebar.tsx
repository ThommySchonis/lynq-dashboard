'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { SETTINGS_NAV, ALL_SETTINGS_ITEMS } from '@/lib/settings-constants'

export function SettingsSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const filtered = query.trim().length > 0
    ? ALL_SETTINGS_ITEMS.filter(item =>
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

  const personalGroupIndex = SETTINGS_NAV.findIndex(g => g.label === 'PERSONAL')

  return (
    <aside className="fixed left-[208px] top-0 bottom-0 w-[260px] bg-secondary border-r border-[#E5E0EB] flex flex-col z-40">
      {/* Header */}
      <div className="px-4 pt-5 pb-4 border-b border-[#E5E0EB] flex-shrink-0">
        <h2 className="text-[22px] font-semibold text-foreground mb-3 mt-0 leading-tight">
          Settings
        </h2>

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
            className="pl-8 pr-10 py-2 text-[13px] bg-white border-[#E5E0EB] text-foreground placeholder:text-foreground-4 focus-visible:ring-primary/20 focus-visible:border-primary"
          />

          {/* ⌘K hint badge */}
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-foreground-4 bg-[#F0EDF4] rounded-[3px] px-1 leading-[1.6] pointer-events-none">
            ⌘K
          </span>

          {/* Dropdown results */}
          {dropdownOpen && filtered.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-[#E5E0EB] rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.08)] z-[100] max-h-[280px] overflow-y-auto"
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
              className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-[#E5E0EB] rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.08)] z-[100]"
            >
              <p className="py-3 px-3 text-[13px] text-foreground-4 text-center">
                No results for &ldquo;{query}&rdquo;
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Nav scroll area */}
      <nav className="flex-1 overflow-y-auto py-2 pb-5 [scrollbar-width:thin] [scrollbar-color:#E5E0EB_transparent] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#E5E0EB] [&::-webkit-scrollbar-thumb]:rounded-sm">
        {SETTINGS_NAV.map((group, groupIdx) => (
          <div key={group.label}>
            {groupIdx === personalGroupIndex && (
              <div className="h-px bg-[#F0EDF4] mx-4 my-2" />
            )}

            <div className={`px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-4 select-none ${groupIdx === 0 ? 'pt-3' : 'pt-5'}`}>
              {group.label}
            </div>

            {group.items.map(item => (
              <div key={item.href} className="px-2 py-0.5">
                <Link
                  href={item.href}
                  className={[
                    'flex items-center w-full px-2 py-[7px] rounded-md text-sm no-underline transition-colors',
                    pathname === item.href
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground font-normal hover:bg-black/[0.04] hover:text-foreground',
                    'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-2px]',
                  ].join(' ')}
                >
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
