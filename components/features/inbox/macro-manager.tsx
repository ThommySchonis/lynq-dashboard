'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Archive, ArchiveRestore, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { authFetch } from '@/lib/inbox-utils'
import { useAuthStore } from '@/stores/auth'
import type { Macro } from '@/types'

interface MacroManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FAV_KEY = 'lynq_macro_favs'
const LANGUAGES = ['English', 'Dutch', 'German', 'French', 'Spanish', 'Italian', 'Portuguese']

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

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return '—'
  }
}

// ─── Macro Editor Form ───────────────────────────────────────────────────────

interface MacroEditorProps {
  macro: Macro | null
  onSave: (macro: Macro) => void
  onDelete: (id: string) => void
  onBack: () => void
  saving: boolean
  deleting: boolean
}

const VARS = [
  { label: 'Customer first name', value: '{{name}}' },
  { label: 'Order number', value: '{{order_number}}' },
  { label: 'Tracking link', value: '{{tracking_link}}' },
  { label: 'Agent name', value: '{{agent_name}}' },
]

function MacroEditor({ macro, onSave, onDelete, onBack, saving, deleting }: MacroEditorProps) {
  const isNew = !macro?.id
  const [name, setName] = useState(macro?.name ?? '')
  const [body, setBody] = useState(macro?.body ?? macro?.content ?? '')
  const [tagInput, setTagInput] = useState((macro?.tags ?? []).join(', '))
  const [language, setLanguage] = useState(macro?.language ?? 'English')

  function insertVar(v: string) {
    setBody((prev) => {
      const el = document.getElementById('macro-body') as HTMLTextAreaElement | null
      if (el) {
        const s = el.selectionStart
        const e = el.selectionEnd
        const newVal = prev.slice(0, s) + v + prev.slice(e)
        // Restore cursor after React re-render
        requestAnimationFrame(() => {
          el.setSelectionRange(s + v.length, s + v.length)
          el.focus()
        })
        return newVal
      }
      return prev + v
    })
  }

  function handleSave() {
    if (!name.trim()) return
    const tags = tagInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    onSave({
      id: macro?.id ?? `m_${Date.now()}`,
      name: name.trim(),
      body,
      content: body,
      tags,
      language,
      usageCount: macro?.usageCount ?? 0,
      updatedAt: new Date().toISOString(),
      archived: macro?.archived ?? false,
    })
  }

  function handleDelete() {
    if (!macro?.id) return
    if (!confirm('Delete this macro? This cannot be undone.')) return
    onDelete(macro.id)
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      {/* Top bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-6 py-3.5">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Separator orientation="vertical" className="h-4" />
        <span className="text-sm font-semibold">
          {isNew ? 'Create macro' : `Edit: ${macro?.name}`}
        </span>
      </div>

      {/* Form body */}
      <div className="flex w-full max-w-3xl flex-col gap-6 p-8 mx-auto">
        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="macro-name">
            Macro name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="macro-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Delivery - Delay"
          />
          <p className="text-xs text-muted-foreground">Name that all agents will see while searching for it</p>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="macro-body">Response text</Label>
          {/* Variable insertion bar */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-t-md border border-b-0 border-border bg-muted/40 px-3 py-2">
            {VARS.map((v) => (
              <button
                key={v.value}
                type="button"
                onClick={() => insertVar(v.value)}
                className="rounded border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {v.label}
              </button>
            ))}
          </div>
          <Textarea
            id="macro-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your macro response here. Use the variable buttons above to insert dynamic values."
            className="min-h-48 rounded-t-none font-mono text-sm"
          />
        </div>

        {/* Tags + Language row */}
        <div className="flex gap-6">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="macro-tags">
              Tags <span className="text-xs font-normal text-muted-foreground">(comma separated)</span>
            </Label>
            <Input
              id="macro-tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="e.g. shipping, support"
            />
          </div>
          <div className="flex w-44 flex-col gap-1.5">
            <Label>Language</Label>
            <Select value={language} onValueChange={(v) => setLanguage(v ?? 'English')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Language this macro is written in</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={!name.trim() || saving}>
              {saving ? 'Saving…' : isNew ? 'Create macro' : 'Update macro'}
            </Button>
          </div>
          {!isNew && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete macro'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Macro Manager Main ──────────────────────────────────────────────────────

export function MacroManager({ open, onOpenChange }: MacroManagerProps) {
  const token = useAuthStore((s) => s.session?.access_token ?? '')

  const [macros, setMacros] = useState<Macro[]>([])
  const [favs, setFavs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'active' | 'archived'>('active')
  const [langFilter, setLangFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')

  // Selected + editing
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Macro | null | 'new'>(null)
  const showEditor = editing !== null

  const allTags = [...new Set(macros.flatMap((m) => m.tags ?? []))].sort()
  const allLangs = [...new Set(macros.map((m) => m.language ?? 'English'))].sort()

  async function loadMacros() {
    if (!token) return
    setLoading(true)
    try {
      const res = await authFetch('/api/macros', {}, token)
      const data = await res.json()
      setMacros(data.macros ?? data ?? [])
    } catch {
      // non-critical
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      setFavs(loadFavs())
      loadMacros()
      setEditing(null)
      setSelectedId(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token])

  function toggleFav(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setFavs((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      saveFavs(next)
      return next
    })
  }

  async function handleSave(macro: Macro) {
    if (!token) return
    setSaving(true)
    try {
      const isNew = !macros.find((m) => m.id === macro.id)
      const payload = {
        name: macro.name,
        body: macro.body,
        tags: macro.tags,
        language: macro.language,
      }
      if (isNew) {
        const res = await authFetch('/api/macros', { method: 'POST', body: JSON.stringify(payload) }, token)
        const data = await res.json()
        const created: Macro = data.macro ?? data
        setMacros((prev) => [...prev, created])
      } else {
        await authFetch(`/api/macros/${macro.id}`, { method: 'PUT', body: JSON.stringify(payload) }, token)
        setMacros((prev) => prev.map((m) => (m.id === macro.id ? { ...m, ...macro } : m)))
      }
      setEditing(null)
      setSelectedId(macro.id)
    } catch {
      // non-critical
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!token) return
    setDeleting(true)
    try {
      await authFetch(`/api/macros/${id}`, { method: 'DELETE' }, token)
      setMacros((prev) => prev.filter((m) => m.id !== id))
      setEditing(null)
      setSelectedId(null)
    } catch {
      // non-critical
    } finally {
      setDeleting(false)
    }
  }

  async function handleArchive(macro: Macro) {
    if (!token) return
    const updated = { ...macro, archived: !macro.archived, updatedAt: new Date().toISOString() }
    try {
      await authFetch(
        `/api/macros/${macro.id}`,
        { method: 'PUT', body: JSON.stringify({ archived: updated.archived }) },
        token,
      )
      setMacros((prev) => prev.map((m) => (m.id === macro.id ? updated : m)))
    } catch {
      // non-critical
    }
  }

  const visible = macros.filter((m) => {
    if (tab === 'active' && m.archived) return false
    if (tab === 'archived' && !m.archived) return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !m.name.toLowerCase().includes(q) &&
        !(m.body ?? '').toLowerCase().includes(q) &&
        !(m.tags ?? []).some((t) => t.toLowerCase().includes(q))
      ) {
        return false
      }
    }
    if (langFilter !== 'all' && (m.language ?? 'English') !== langFilter) return false
    if (tagFilter !== 'all' && !(m.tags ?? []).includes(tagFilter)) return false
    return true
  })

  const selectedMacro = selectedId ? macros.find((m) => m.id === selectedId) ?? null : null
  const editorMacro = editing === 'new' ? null : (editing as Macro | null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-w-6xl flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <div className="flex items-center gap-4">
            <DialogTitle className="text-base font-semibold">Macros</DialogTitle>
            <div className="flex flex-1 items-center gap-2">
              {/* Search */}
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search macros…"
                className="h-8 w-48 text-sm"
              />
              {/* Language filter */}
              <Select value={langFilter} onValueChange={(v) => setLangFilter(v ?? 'all')}>
                <SelectTrigger className="h-8 w-36 text-sm">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All languages</SelectItem>
                  {allLangs.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Tag filter */}
              <Select value={tagFilter} onValueChange={(v) => setTagFilter(v ?? 'all')}>
                <SelectTrigger className="h-8 w-36 text-sm">
                  <SelectValue placeholder="All tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tags</SelectItem>
                  {allTags.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditing('new')
                setSelectedId(null)
              }}
              className="gap-1.5"
            >
              <Plus className="size-3.5" />
              Create macro
            </Button>
          </div>
          {/* Archive tabs */}
          <div className="mt-3 flex gap-0 border-b border-border">
            {(['active', 'archived'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`border-b-2 px-4 py-2 text-sm font-medium capitalize transition-colors ${
                  tab === t
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </DialogHeader>

        {/* Two-column body */}
        <div className="flex min-h-0 flex-1">
          {/* Left: macro list */}
          <div className="flex w-80 shrink-0 flex-col border-r border-border">
            <ScrollArea className="flex-1">
              {loading && (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
              )}
              {!loading && visible.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">No macros found</div>
              )}
              {!loading && visible.map((m) => {
                const isSelected = selectedId === m.id
                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      setSelectedId(m.id)
                      setEditing(m)
                    }}
                    className={`group flex cursor-pointer items-start gap-2 border-b border-border px-4 py-3 transition-colors hover:bg-muted/50 ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                  >
                    {/* Star */}
                    <button
                      type="button"
                      onClick={(e) => toggleFav(m.id, e)}
                      className={`mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-amber-500 ${
                        favs.includes(m.id) ? 'text-amber-500' : 'opacity-40 group-hover:opacity-100'
                      }`}
                      title={favs.includes(m.id) ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Star className={`size-3.5 ${favs.includes(m.id) ? 'fill-amber-500' : ''}`} />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{m.name}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(m.tags ?? []).map((tag) => (
                          <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {m.language ?? 'English'} · Updated {fmtDate(m.updatedAt)}
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleArchive(m)
                        }}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        title={m.archived ? 'Unarchive' : 'Archive'}
                      >
                        {m.archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!confirm('Delete this macro? This cannot be undone.')) return
                          handleDelete(m.id)
                        }}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </ScrollArea>
          </div>

          {/* Right: editor / empty state */}
          <div className="flex flex-1 flex-col">
            {showEditor ? (
              <MacroEditor
                macro={editorMacro}
                onSave={handleSave}
                onDelete={handleDelete}
                onBack={() => {
                  setEditing(null)
                  setSelectedId(null)
                }}
                saving={saving}
                deleting={deleting}
              />
            ) : selectedMacro ? (
              <div className="flex flex-1 flex-col items-start gap-4 p-8">
                <div className="flex w-full items-center justify-between">
                  <h3 className="text-base font-semibold">{selectedMacro.name}</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(selectedMacro)}
                    className="gap-1.5"
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(selectedMacro.tags ?? []).map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="w-full rounded-md border border-border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
                  {selectedMacro.body ?? selectedMacro.content}
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center text-sm text-muted-foreground">
                  <p>Select a macro to preview</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 gap-1.5"
                    onClick={() => setEditing('new')}
                  >
                    <Plus className="size-3.5" />
                    Create macro
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
