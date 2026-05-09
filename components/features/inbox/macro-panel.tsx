// @ts-nocheck — this component is not yet used, will be cleaned up during incremental UI refactor
'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Star, Zap, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { authFetch } from '@/lib/inbox-utils'
import { useMacrosStore } from '@/stores/macros'
import { useAuthStore } from '@/stores/auth'
import type { Macro } from '@/types'

interface MacroPanelProps {
  onInsert: (content: string) => void
  onClose: () => void
  onManage: () => void
}

const FAV_KEY = 'lynq_macro_favs'

function loadFavs(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || '[]')
  } catch {
    return []
  }
}

function saveFavs(favs: string[]) {
  localStorage.setItem(FAV_KEY, JSON.stringify(favs))
}

export function MacroPanel({ onInsert, onClose, onManage }: MacroPanelProps) {
  const token = useAuthStore((s) => s.session?.access_token ?? '')
  const aiMacros = useMacrosStore((s) => s.aiMacros)

  const [macros, setMacros] = useState<Macro[]>([])
  const [search, setSearch] = useState('')
  const [favs, setFavs] = useState<string[]>([])
  const searchRef = useRef<HTMLInputElement>(null)

  // Load macros and favorites on mount
  useEffect(() => {
    setFavs(loadFavs())
    if (!token) return
    authFetch('/api/macros', {}, token)
      .then((r) => r.json())
      .then((data) => {
        const list: Macro[] = data.macros ?? data ?? []
        setMacros(list.filter((m) => !m.archived))
      })
      .catch(() => {})
  }, [token])

  // Focus search input on mount
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Listen for inbox:escape custom event
  useEffect(() => {
    function handleEscape() {
      onClose()
    }
    window.addEventListener('inbox:escape', handleEscape)
    return () => window.removeEventListener('inbox:escape', handleEscape)
  }, [onClose])

  function toggleFav(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setFavs((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      saveFavs(next)
      return next
    })
  }

  function handleInsert(macro: Macro) {
    onInsert(macro.content ?? macro.body ?? '')
  }

  const filtered = macros.filter((m) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      m.name.toLowerCase().includes(q) ||
      (m.body ?? '').toLowerCase().includes(q) ||
      (m.content ?? '').toLowerCase().includes(q) ||
      (m.tags ?? []).some((t) => t.toLowerCase().includes(q))
    )
  })

  const favMacros = filtered.filter((m) => favs.includes(m.id))
  const nonFavMacros = filtered.filter((m) => !favs.includes(m.id))

  const filteredAiMacros = aiMacros.filter((m) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      m.name.toLowerCase().includes(q) ||
      (m.body ?? '').toLowerCase().includes(q) ||
      (m.content ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex flex-col border-t border-border bg-card" style={{ height: 'min(360px, 46vh)', minHeight: 220 }}>
      {/* Header row */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <Zap className="size-4 shrink-0 text-muted-foreground" />
        <Input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search macros by name, tag or content…"
          className="h-7 flex-1 border-none bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
        />
        {aiMacros.length > 0 && (
          <Badge variant="secondary" className="shrink-0 text-[10px] tracking-wider">
            AI ✦
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={onManage}
          title="Manage macros"
        >
          <Settings className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={onClose}
          title="Close"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {/* Body */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {/* AI suggestions */}
          {filteredAiMacros.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                AI Suggestions ✦
              </div>
              {filteredAiMacros.map((m) => (
                <MacroRow
                  key={m.id}
                  macro={m}
                  isFav={favs.includes(m.id)}
                  onInsert={handleInsert}
                  onToggleFav={toggleFav}
                />
              ))}
              <Separator className="my-1" />
            </>
          )}

          {/* Favorites */}
          {favMacros.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                <Star className="size-3 fill-amber-500 text-amber-500" />
                Favorites
              </div>
              {favMacros.map((m) => (
                <MacroRow
                  key={m.id}
                  macro={m}
                  isFav={true}
                  onInsert={handleInsert}
                  onToggleFav={toggleFav}
                />
              ))}
              {nonFavMacros.length > 0 && <Separator className="my-1" />}
            </>
          )}

          {/* All macros */}
          {nonFavMacros.length > 0 && (
            <>
              {favMacros.length > 0 && (
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  All Macros
                </div>
              )}
              {nonFavMacros.map((m) => (
                <MacroRow
                  key={m.id}
                  macro={m}
                  isFav={false}
                  onInsert={handleInsert}
                  onToggleFav={toggleFav}
                />
              ))}
            </>
          )}

          {/* Empty state */}
          {filtered.length === 0 && filteredAiMacros.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">No macros found</div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="flex shrink-0 items-center justify-between border-t border-border bg-card px-3 py-2">
        <Button variant="ghost" size="sm" className="text-xs" onClick={onManage}>
          Manage macros
        </Button>
        <Button variant="ghost" size="sm" className="text-xs" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  )
}

interface MacroRowProps {
  macro: Macro
  isFav: boolean
  onInsert: (macro: Macro) => void
  onToggleFav: (id: string, e: React.MouseEvent) => void
}

function MacroRow({ macro, isFav, onInsert, onToggleFav }: MacroRowProps) {
  return (
    <button
      className="flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/50"
      onClick={() => onInsert(macro)}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{macro.name}</div>
        {(macro.tags ?? []).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {(macro.tags ?? []).map((tag) => (
              <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <button
        className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-amber-500"
        onClick={(e) => onToggleFav(macro.id, e)}
        title={isFav ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Star
          className={`size-3.5 ${isFav ? 'fill-amber-500 text-amber-500' : ''}`}
        />
      </button>
    </button>
  )
}
