'use client'

import type { Note } from '@/types/inbox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileText, ChevronDown } from 'lucide-react'
import { relTime as formatDate } from '@/lib/inbox-utils'
import { useInboxUI } from '@/stores/inbox-ui'
import { useAuthStore } from '@/stores/auth'
import { useConversation } from '@/hooks/inbox/use-inbox-data'
import { useAddNote } from '@/hooks/inbox/use-inbox-mutations'
import { useMemo } from 'react'
import { toast as sonnerToast } from 'sonner'

export function NotesSection() {
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const selectedThreadId = useInboxUI((s) => s.selectedThreadId)
  const showNotes = useInboxUI((s) => s.showNotes)
  const setShowNotes = useInboxUI((s) => s.setShowNotes)
  const noteInput = useInboxUI((s) => s.noteInput)
  const setNoteInput = useInboxUI((s) => s.setNoteInput)
  const addingNote = useInboxUI((s) => s.addingNote)
  const setAddingNote = useInboxUI((s) => s.setAddingNote)

  const { data: conversationData } = useConversation(selectedThreadId)
  const notes = useMemo(() => conversationData?.notes || [], [conversationData?.notes])

  const addNoteMutation = useAddNote()

  async function handleAddNote() {
    if (!noteInput.trim() || !selectedThreadId) return
    setAddingNote(true)
    try {
      await addNoteMutation.mutateAsync({
        threadId: selectedThreadId,
        body: noteInput.trim(),
      })
      setNoteInput('')
    } catch {
      sonnerToast.error('Failed to add note')
    }
    setAddingNote(false)
  }

  return (
    <>
      {/* Internal Notes Section */}
      {notes.length > 0 && (
        <div className="mt-2">
          <Button
            variant="ghost"
            onClick={() => setShowNotes((v) => !v)}
            className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-bold tracking-[.06em] uppercase py-1.5 px-0 font-inherit"
          >
            <span className="flex">
              <FileText size={12} />
            </span>
            Internal Notes ({notes.length})
            <ChevronDown size={10} className={`transition-transform duration-200 ${showNotes ? 'rotate-180' : 'rotate-0'}`} />
          </Button>
          {showNotes &&
            notes.map((note: Note, ni: number) => (
              <div key={note.id || ni} className="mb-3" style={{ animation: 'msgIn .3s cubic-bezier(.16,1,.3,1) both' }}>
                <div className="text-xs mb-[5px]">
                  <span className="text-[10.5px] text-foreground-2 font-bold tracking-[.01em] text-[rgba(251,191,36,0.75)]">Note</span>
                  <span className="text-[10px] text-muted-foreground ml-[7px] font-normal">{formatDate(note.created_at)}</span>
                </div>
                <div className="bg-[#FFFBEB] border border-[#FDE68A] border-l-[3px] border-l-[#F59E0B] rounded-[2px_14px_14px_14px] px-[18px] py-[14px] text-[13.5px] leading-[1.75] text-[#0F172A] whitespace-pre-wrap break-words dark:bg-[rgba(251,191,36,0.08)] dark:border-[rgba(251,191,36,0.2)] dark:border-l-[rgba(251,191,36,0.5)] dark:text-(--foreground)">
                  <div className="text-[10px] font-bold text-[rgba(251,191,36,0.75)] tracking-[.07em] uppercase mb-[7px]">Internal note</div>
                  {note.body}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Add note inline */}
      <div className="mt-2 flex gap-2 items-start">
        <Input
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) void handleAddNote()
          }}
          placeholder="Add an internal note..."
          className="flex-1 px-3 py-2 border border-[#FDE68A] rounded-lg text-[12.5px] text-foreground bg-[rgba(251,191,36,0.04)] font-inherit outline-none transition-[border-color] duration-200"
        />
        <Button
          variant="outline"
          onClick={() => void handleAddNote()}
          disabled={isSuspended || addingNote || !noteInput.trim()}
          className={`px-3.5 py-2 rounded-lg border border-[#FDE68A] bg-[rgba(251,191,36,0.08)] text-[#F59E0B] text-xs font-semibold font-inherit transition-all duration-150 shrink-0 whitespace-nowrap ${addingNote || !noteInput.trim() ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {addingNote ? 'Adding...' : 'Add Note'}
        </Button>
      </div>
    </>
  )
}
