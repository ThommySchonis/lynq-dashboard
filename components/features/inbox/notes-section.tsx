'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { relTime } from '@/lib/inbox-utils'
import type { Note } from '@/types'

interface NotesSectionProps {
  notes: Note[]
  onAddNote: (text: string) => void
  loading?: boolean
}

export function NotesSection({ notes, onAddNote, loading = false }: NotesSectionProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [noteInput, setNoteInput] = useState('')

  function handleAdd() {
    const trimmed = noteInput.trim()
    if (!trimmed) return
    onAddNote(trimmed)
    setNoteInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className="border-t border-border bg-muted/10">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        {collapsed ? (
          <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown size={16} className="shrink-0 text-muted-foreground" />
        )}
        <span className="text-sm font-medium">Internal Notes</span>
        <Badge variant="secondary" className="ml-1 text-xs">
          {notes.length}
        </Badge>
      </button>

      {/* Collapsible body */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-3">
          {/* Note list */}
          {notes.length > 0 ? (
            <ul className="space-y-2">
              {notes.map((note) => (
                <li key={note.id} className="rounded-md border border-border bg-card px-3 py-2 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-foreground">{note.author_name}</span>
                    <span className="text-xs text-muted-foreground">{relTime(note.created_at)}</span>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{note.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No internal notes yet.</p>
          )}

          {/* Add note input */}
          <div className="flex gap-2">
            <Input
              placeholder="Add a note..."
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              className="flex-1 text-sm"
            />
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={loading || !noteInput.trim()}
            >
              Add Note
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
