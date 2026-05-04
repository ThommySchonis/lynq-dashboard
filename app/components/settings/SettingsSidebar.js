'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search } from 'lucide-react'

const NAV_GROUPS = [
  { label: 'WORKSPACE', items: [
    { label: 'General', href: '/settings/workspace/general' },
    { label: 'Users', href: '/settings/workspace/members' },
    { label: 'Macros', href: '/settings/workspace/macros' },
    { label: 'Billing', href: '/settings/workspace/billing' },
  ]},
  { label: 'EMAIL', items: [
    { label: 'Email',   href: '/settings/email' },
  ]},
  { label: 'INTEGRATIONS', items: [
    { label: 'Shopify', href: '/settings/integrations/shopify' },
  ]},
  { label: 'PERSONAL', items: [
    { label: 'Profile',        href: '/settings/personal/profile' },
    { label: 'Password & 2FA', href: '/settings/personal/security' },
  ]},
]

// Flat list of all items for search
const ALL_ITEMS = NAV_GROUPS.flatMap(g => g.items.map(item => ({ ...item, group: g.label })))

const CSS = `
  .ss-root {
    position: fixed;
    left: 208px;
    top: 0;
    bottom: 0;
    width: 260px;
    background: #F8F7FA;
    border-right: 1px solid #E5E0EB;
    display: flex;
    flex-direction: column;
    z-index: 40;
    font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .ss-header {
    padding: 20px 16px 16px;
    border-bottom: 1px solid #E5E0EB;
    flex-shrink: 0;
  }

  .ss-title {
    font-size: 22px;
    font-weight: 600;
    color: #1C0F36;
    margin-bottom: 12px;
    margin-top: 0;
    line-height: 1.2;
  }

  .ss-search-wrap {
    position: relative;
  }

  .ss-search-icon {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: #9B91A8;
    display: flex;
    align-items: center;
    pointer-events: none;
  }

  .ss-search-input {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 46px 8px 34px;
    font-size: 13px;
    font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #FFFFFF;
    border: 1px solid #E5E0EB;
    border-radius: 6px;
    color: #1C0F36;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .ss-search-input::placeholder { color: #9B91A8; }
  .ss-search-input:focus {
    border-color: #A175FC;
    box-shadow: 0 0 0 3px rgba(161,117,252,0.12);
  }

  .ss-cmd-hint {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 10px;
    color: #9B91A8;
    background: #F0EDF4;
    border-radius: 3px;
    padding: 1px 4px;
    pointer-events: none;
    line-height: 1.6;
  }

  .ss-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: #FFFFFF;
    border: 1px solid #E5E0EB;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.08);
    z-index: 100;
    max-height: 280px;
    overflow-y: auto;
  }

  .ss-dropdown-item {
    padding: 9px 12px;
    cursor: pointer;
    font-size: 13px;
    color: #1C0F36;
    transition: background 0.1s;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .ss-dropdown-item:hover { background: #F8F7FA; }
  .ss-dropdown-item-group {
    font-size: 10px;
    color: #9B91A8;
    font-weight: 500;
    letter-spacing: 0.04em;
  }

  .ss-nav-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0 20px;
  }
  .ss-nav-scroll::-webkit-scrollbar { width: 3px; }
  .ss-nav-scroll::-webkit-scrollbar-track { background: transparent; }
  .ss-nav-scroll::-webkit-scrollbar-thumb { background: #E5E0EB; border-radius: 2px; }

  .ss-group-label {
    padding: 20px 16px 6px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #9B91A8;
    user-select: none;
  }
  .ss-group-label.first { padding-top: 12px; }

  .ss-item-wrap {
    padding: 2px 8px;
  }

  .ss-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 7px 8px;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    text-align: left;
    text-decoration: none;
    color: #6B5E7B;
    background: transparent;
    font-weight: 400;
    font-family: 'Switzer', -apple-system, BlinkMacSystemFont, sans-serif;
    transition: background 0.1s, color 0.1s;
    border: none;
    outline: none;
    box-sizing: border-box;
    line-height: 1.4;
  }
  .ss-item:hover {
    background: rgba(0,0,0,0.04);
    color: #1C0F36;
  }
  .ss-item.active {
    background: #EDE5FE;
    color: #A175FC;
    font-weight: 500;
  }
  .ss-item:focus-visible {
    outline: 2px solid #A175FC;
    outline-offset: -2px;
  }

  .ss-divider {
    height: 1px;
    background: #F0EDF4;
    margin: 8px 16px;
  }
`

export default function SettingsSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const searchRef = useRef(null)
  const dropdownRef = useRef(null)

  const filtered = query.trim().length > 0
    ? ALL_ITEMS.filter(item => item.label.toLowerCase().includes(query.toLowerCase()))
    : []

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        searchRef.current && !searchRef.current.contains(e.target)
      ) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSearchKeyDown(e) {
    if (e.key === 'Escape') {
      setQuery('')
      setDropdownOpen(false)
      searchRef.current?.blur()
    }
  }

  function handleSearchChange(e) {
    setQuery(e.target.value)
    setDropdownOpen(e.target.value.trim().length > 0)
  }

  function handleDropdownItemClick(href) {
    setQuery('')
    setDropdownOpen(false)
    router.push(href)
  }

  const personalGroupIndex = NAV_GROUPS.findIndex(g => g.label === 'PERSONAL')

  return (
    <>
      <style>{CSS}</style>
      <aside className="ss-root">
        {/* Header */}
        <div className="ss-header">
          <h2 className="ss-title">Settings</h2>
          <div className="ss-search-wrap" ref={searchRef}>
            <span className="ss-search-icon">
              <Search size={14} strokeWidth={1.75} />
            </span>
            <input
              className="ss-search-input"
              type="text"
              placeholder="Search settings…"
              value={query}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => query.trim().length > 0 && setDropdownOpen(true)}
              autoComplete="off"
            />
            <span className="ss-cmd-hint">⌘K</span>

            {dropdownOpen && filtered.length > 0 && (
              <div className="ss-dropdown" ref={dropdownRef}>
                {filtered.map(item => (
                  <div
                    key={item.href}
                    className="ss-dropdown-item"
                    onMouseDown={() => handleDropdownItemClick(item.href)}
                  >
                    <span>{item.label}</span>
                    <span className="ss-dropdown-item-group">{item.group}</span>
                  </div>
                ))}
              </div>
            )}
            {dropdownOpen && filtered.length === 0 && query.trim().length > 0 && (
              <div className="ss-dropdown" ref={dropdownRef}>
                <div style={{ padding: '12px', fontSize: 13, color: '#9B91A8', textAlign: 'center' }}>
                  No results for &ldquo;{query}&rdquo;
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Nav scroll area */}
        <nav className="ss-nav-scroll">
          {NAV_GROUPS.map((group, groupIdx) => (
            <div key={group.label}>
              {groupIdx === personalGroupIndex && (
                <div className="ss-divider" />
              )}
              <div className={`ss-group-label${groupIdx === 0 ? ' first' : ''}`}>
                {group.label}
              </div>
              {group.items.map(item => (
                <div key={item.href} className="ss-item-wrap">
                  <Link
                    href={item.href}
                    className={`ss-item${pathname === item.href ? ' active' : ''}`}
                  >
                    {item.label}
                  </Link>
                </div>
              ))}
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}
