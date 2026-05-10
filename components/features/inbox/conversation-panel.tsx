// @ts-nocheck
'use client'

import { MacroPanel } from '@/components/features/inbox/macro-panel'
import { TicketActionBar } from '@/components/features/inbox/ticket-action-bar'
import { AvatarFallback, Avatar as ShadAvatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { STATUS } from '@/lib/inbox-constants'
import {
  EMOJIS,
  extractEmail,
  extractName,
  relTime as formatDate,
  plainTextToSafeHtml,
  sanitizeHtml,
} from '@/lib/inbox-utils'
import {
  Check,
  ChevronDown,
  FileText,
  Globe,
  ImageIcon,
  Link2,
  Loader2,
  Mail,
  Paperclip,
  Radio,
  Send,
  Smile,
  X,
  Zap,
} from 'lucide-react'
import { useRef, useCallback, useEffect, useMemo } from 'react'
import { toast as sonnerToast } from 'sonner'
import { useInboxUI } from '@/stores/inbox-ui'
import { useAuthStore } from '@/stores/auth'
import { useAIStore } from '@/stores/ai'
import { useMacrosStore } from '@/stores/macros'
import { useTicketMetaStore } from '@/stores/ticket-meta'
import { useConversations, useConversation } from '@/hooks/inbox/use-inbox-data'
import {
  useSendReply,
  useUpdateStatus,
  useAddNote,
  useTranslateMessage,
} from '@/hooks/inbox/use-inbox-mutations'
import { useComposerActions } from '@/hooks/inbox/use-composer-actions'

export function ConversationPanel() {
  // Refs (local to this component)
  const composerRef = useRef<HTMLDivElement>(null)
  const imgUploadRef = useRef<HTMLInputElement>(null)
  const fileUploadRef = useRef<HTMLInputElement>(null)
  const msgEndRef = useRef<HTMLDivElement>(null)

  // Auth
  const session = useAuthStore((s) => s.session)
  const token = session?.access_token ?? ''

  // Zustand UI state
  const selectedThreadId = useInboxUI((s) => s.selectedThreadId)
  const composerTab = useInboxUI((s) => s.composerTab)
  const reply = useInboxUI((s) => s.reply)
  const showEmoji = useInboxUI((s) => s.showEmoji)
  const attachments = useInboxUI((s) => s.attachments)
  const showMacros = useInboxUI((s) => s.showMacros)
  const showNotes = useInboxUI((s) => s.showNotes)
  const noteInput = useInboxUI((s) => s.noteInput)
  const sending = useInboxUI((s) => s.sending)
  const addingNote = useInboxUI((s) => s.addingNote)
  const activeFolder = useInboxUI((s) => s.activeFolder)
  const search = useInboxUI((s) => s.search)
  const setComposerTab = useInboxUI((s) => s.setComposerTab)
  const setReply = useInboxUI((s) => s.setReply)
  const setShowEmoji = useInboxUI((s) => s.setShowEmoji)
  const setAttachments = useInboxUI((s) => s.setAttachments)
  const setShowMacros = useInboxUI((s) => s.setShowMacros)
  const setShowMacroManager = useInboxUI((s) => s.setShowMacroManager)
  const setShowNotes = useInboxUI((s) => s.setShowNotes)
  const setNoteInput = useInboxUI((s) => s.setNoteInput)
  const setSending = useInboxUI((s) => s.setSending)
  const setAddingNote = useInboxUI((s) => s.setAddingNote)
  const setSelectedThreadId = useInboxUI((s) => s.setSelectedThreadId)

  // AI state
  const aiLoading = useAIStore((s) => s.aiLoading)
  const autoTranslate = useAIStore((s) => s.autoTranslate)
  const customerLang = useAIStore((s) => s.customerLang)
  const msgTranslations = useAIStore((s) => s.translations)
  const setAutoTranslate = useAIStore((s) => s.setAutoTranslate)
  const setTranslation = useAIStore((s) => s.setTranslation)
  const translateMessage = useAIStore((s) => s.translateMessage)
  const generateReply = useAIStore((s) => s.generateReply)

  // Macros
  const macros = useMacrosStore((s) => s.macros)
  const aiMacros = useMacrosStore((s) => s.aiMacros)
  const macroFavs = useMacrosStore((s) => s.favs)
  const toggleMacroFav = useMacrosStore((s) => s.toggleFav)
  const deleteMacro = useMacrosStore((s) => s.deleteMacro)

  // Ticket meta
  const getTicketMeta = useTicketMetaStore((s) => s.getMeta)
  const addTag = useTicketMetaStore((s) => s.addTag)
  const removeTag = useTicketMetaStore((s) => s.removeTag)
  const updateMeta = useTicketMetaStore((s) => s.updateMeta)

  // TanStack data
  const { data: threads = [] } = useConversations(activeFolder, search)
  const { data: conversationData, isLoading: loadingMsgs } = useConversation(selectedThreadId)
  const messages = useMemo(() => conversationData?.messages || [], [conversationData?.messages])
  const notes = useMemo(() => conversationData?.notes || [], [conversationData?.notes])

  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) || null,
    [threads, selectedThreadId],
  )

  // Mutations
  const sendReplyMutation = useSendReply()
  const updateStatusMutation = useUpdateStatus()
  const addNoteMutation = useAddNote()
  const translateMutation = useTranslateMessage()

  // Composer actions
  const { formatDoc, insertLink, handleImageUpload, handleFileAttach, insertEmoji } = useComposerActions(
    composerRef,
    setReply,
    setAttachments,
    (msg, type = 'success') => {
      type === 'success' ? sonnerToast.success(msg) : sonnerToast.error(msg)
    },
  )

  // Scroll to bottom on new messages
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Status helpers
  const getStatus = useCallback(
    (id) => {
      const thread = threads.find((t) => t.id === id)
      return thread?.status || 'open'
    },
    [threads],
  )

  async function saveStatus(id, s) {
    await updateStatusMutation.mutateAsync({ threadId: id, status: s })
  }

  function addTicketTag(id) {
    const tag = prompt('Add tag:')
    if (!tag?.trim()) return
    addTag(id, tag.trim())
  }

  function updateTicketField(id, key, label) {
    const value = prompt(`${label}:`)
    if (value === null) return
    updateMeta(id, { [key]: value.trim() })
  }

  // Sorted threads for send & resolve navigation
  const sortedFiltered = useMemo(() => threads, [threads])

  // Send reply
  async function handleSend() {
    const textContent = composerRef.current?.textContent || reply
    if (!textContent.trim() || !selectedThreadId) return false
    setSending(true)
    let bodyHtml = sanitizeHtml(composerRef.current?.innerHTML || reply)
    let bodyText = textContent
    // Auto-translate outgoing message to customer's language
    if (autoTranslate && customerLang && customerLang.code !== 'en') {
      try {
        const td = await translateMutation.mutateAsync({
          text: textContent,
          targetLang: customerLang.name,
        })
        if (td.translated) {
          bodyHtml = plainTextToSafeHtml(td.translated)
          bodyText = td.translated
        }
      } catch {}
    }
    const data = await sendReplyMutation.mutateAsync({
      threadId: selectedThreadId,
      bodyHtml,
      bodyText,
    })
    if (data.success || data.messageId || data.id) {
      sonnerToast.success('Message sent!')
      if (composerRef.current) composerRef.current.innerHTML = ''
      setReply('')
      setAttachments([])
      setSending(false)
      return true
    }
    sonnerToast.error(data.error || 'Failed to send')
    setSending(false)
    return false
  }

  async function handleSendResolve() {
    if (!selectedThreadId) return
    const currentId = selectedThreadId
    const currentIdx = sortedFiltered.findIndex((t) => t.id === currentId)
    const nextThread = sortedFiltered.find((t, i) => i !== currentIdx)
    const ok = await handleSend()
    if (ok) {
      await saveStatus(currentId, 'resolved')
      sonnerToast.success('Resolved & closed')
      if (nextThread) {
        setSelectedThreadId(nextThread.id)
        useInboxUI.getState().resetForNewThread()
      } else setSelectedThreadId(null)
    }
  }

  // AI reply
  async function handleAiReply() {
    if (!messages.length || !selectedThreadId) return
    const replyText = await generateReply(selectedThread, messages, token)
    if (replyText) {
      if (composerRef.current) {
        composerRef.current.innerHTML = plainTextToSafeHtml(replyText)
        setReply(composerRef.current.textContent)
      } else setReply(replyText)
    } else sonnerToast.error('AI reply failed')
  }

  // Add note
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

  if (!selectedThread) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative z-[1]">
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-(--text-3)">
          <div className="opacity-40">
            <Mail size={20} />
          </div>
          <div className="text-[13px]">Select a thread to read</div>
          <div className="text-[11px] text-(--text-3)">j / k navigate · r reply</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative z-[1]">
      {/* Ticket header */}
      <div className="py-3.5 px-[22px] border-b border-border shrink-0 bg-(--bg-surface)">
        <div className="flex items-center gap-3.5">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-(--text-1) overflow-hidden text-ellipsis whitespace-nowrap mb-0.5 tracking-[-0.01em]">
              {selectedThread.subject}
            </div>
            <div className="text-[11.5px] text-(--text-3)">
              {extractName(selectedThread.from)} · {messages.length} message
              {messages.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div className="flex gap-1.5 items-center shrink-0">
            {/* Status dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    className="flex items-center gap-1.5 px-[11px] py-[5px] rounded-[20px] cursor-pointer text-xs font-semibold font-inherit transition-all duration-150"
                    style={{
                      background: STATUS[getStatus(selectedThread.id)]?.bg,
                      border: `1px solid ${STATUS[getStatus(selectedThread.id)]?.border}`,
                      color: STATUS[getStatus(selectedThread.id)]?.color,
                    }}
                  />
                }
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    background: STATUS[getStatus(selectedThread.id)]?.color,
                  }}
                />
                {STATUS[getStatus(selectedThread.id)]?.label}
                <ChevronDown size={11} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {Object.entries(STATUS).map(([k, s]) => (
                  <DropdownMenuItem key={k} onClick={() => saveStatus(selectedThread.id, k)} style={{ color: s.color }}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                    {s.label}
                    {getStatus(selectedThread.id) === k && <span className="ml-auto text-[10px] text-(--text-3)">&#10003;</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <TicketActionBar
          meta={getTicketMeta(selectedThread.id)}
          status={getStatus(selectedThread.id)}
          onClose={() => saveStatus(selectedThread.id, 'closed')}
          onAddTag={() => addTicketTag(selectedThread.id)}
          onRemoveTag={(tag) => removeTag(selectedThread.id, tag)}
          onFieldChange={(field, labelOrValue) =>
            field === 'assignee'
              ? updateMeta(selectedThread.id, { assignee: labelOrValue })
              : updateTicketField(selectedThread.id, field, labelOrValue)
          }
        />
      </div>

      {/* Messages */}
      <div className="sscroll conv-area flex-1 overflow-y-auto px-6 py-5 bg-[#FAFAFA]">
        {loadingMsgs &&
          [0, 1].map((i) => (
            <div
              key={i}
              className={`flex gap-3 ${i % 2 === 0 ? 'flex-row' : 'flex-row-reverse'} mb-5`}
              style={{ animation: `fadeUp .3s ease ${i * 0.1}s both` }}
            >
              <div className="bg-gradient-to-r from-(--skeleton-from) via-(--skeleton-to) to-(--skeleton-from) bg-[length:400%_100%] animate-[shimmer_1.8s_linear_infinite] rounded-md w-[34px] h-[34px] rounded-full shrink-0" />
              <div className="bg-gradient-to-r from-(--skeleton-from) via-(--skeleton-to) to-(--skeleton-from) bg-[length:400%_100%] animate-[shimmer_1.8s_linear_infinite] rounded-md h-20 w-[60%] rounded-[18px]" />
            </div>
          ))}
        {messages.map((msg, idx) => {
          const isAgent = msg.from?.toLowerCase().includes(session.user.email?.split('@')[0]?.toLowerCase() || '')
          const isNote = msg.isNote
          const name = extractName(msg.from)
          const ini = (name || '?')
            .split(' ')
            .map((w) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()
          return (
            <div
              key={msg.id || idx}
              className={`mb-5 flex gap-3 ${isAgent ? 'flex-row-reverse' : 'flex-row'}`}
              style={{ animation: 'msgIn .3s cubic-bezier(.16,1,.3,1) both' }}
            >
              {!isNote && (
                <ShadAvatar className="shrink-0" style={{ width: 26, height: 26 }}>
                  <AvatarFallback className={isAgent ? 'bg-(--text-1) text-white' : 'bg-[#F0F0F0] text-(--text-2)'} style={{ fontSize: 26 * 0.34 }}>
                    {ini}
                  </AvatarFallback>
                </ShadAvatar>
              )}
              <div className="max-w-[72%]">
                <div className={`text-xs mb-[5px] ${isAgent ? 'text-right' : 'text-left'}`}>
                  <span className="text-[10.5px] text-(--text-2) font-bold tracking-[.01em]">{name}</span>
                  <span className="text-[10px] text-(--text-3) ml-[7px] font-normal">{formatDate(msg.date)}</span>
                </div>
                <div className={isNote ? 'msg-note' : isAgent ? 'msg-out' : 'msg-in'}>
                  {isNote && (
                    <div className="text-[10px] font-bold text-[rgba(251,191,36,0.75)] tracking-[.07em] uppercase mb-[7px]">Internal note</div>
                  )}
                  {(() => {
                    const content =
                      msgTranslations[msg.id] && msgTranslations[msg.id] !== '__loading__' ? msgTranslations[msg.id] : msg.body || msg.snippet || ''
                    const isHtml = /<[a-z][\s\S]*>/i.test(content)
                    if (!isHtml) return <span>{content}</span>
                    return (
                      <iframe
                        sandbox="allow-same-origin"
                        srcDoc={
                          '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:8px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;font-size:14px;color:#1a1a1a;word-wrap:break-word;overflow-wrap:break-word}img{max-width:100%;height:auto}a{color:#6d28d9}blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #ddd;color:#666}pre{white-space:pre-wrap;overflow-x:auto}</style></head><body>' +
                          content +
                          '</body></html>'
                        }
                        className="w-full border-none min-h-[60px] rounded-[6px] bg-white"
                        title="Email content"
                        onLoad={(e) => {
                          try {
                            const h = e.target.contentDocument.body.scrollHeight
                            e.target.style.height = h + 16 + 'px'
                          } catch {}
                        }}
                      />
                    )
                  })()}
                </div>
                {!isAgent && !isNote && (
                  <div className="text-left mt-1">
                    {msgTranslations[msg.id] === '__loading__' ? (
                      <span className="text-[10px] text-(--text-3)">Translating…</span>
                    ) : msgTranslations[msg.id] ? (
                      <button
                        className="text-[10px] font-semibold text-(--text-3) bg-transparent cursor-pointer px-[7px] py-[2px] rounded-[5px] transition-all hover:text-(--text-1) hover:bg-(--bg-surface-2)"
                        onClick={() => setTranslation(msg.id, undefined)}
                      >
                        Show original
                      </button>
                    ) : (
                      <button
                        className="text-[10px] font-semibold text-(--text-3) bg-transparent cursor-pointer px-[7px] py-[2px] rounded-[5px] transition-all hover:text-(--text-1) hover:bg-(--bg-surface-2)"
                        onClick={() => translateMessage(msg.id, msg.body || msg.snippet || '', token)}
                      >
                        Translate
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {/* Internal Notes Section */}
        {notes.length > 0 && (
          <div className="mt-2">
            <Button
              variant="ghost"
              onClick={() => setShowNotes((v) => !v)}
              className="flex items-center gap-1.5 text-(--text-3) text-[11px] font-bold tracking-[.06em] uppercase py-1.5 px-0 font-inherit"
            >
              <span className="flex">
                <FileText size={12} />
              </span>
              Internal Notes ({notes.length})
              <ChevronDown size={10} className={`transition-transform duration-200 ${showNotes ? 'rotate-180' : 'rotate-0'}`} />
            </Button>
            {showNotes &&
              notes.map((note, ni) => (
                <div key={note.id || ni} className="mb-3" style={{ animation: 'msgIn .3s cubic-bezier(.16,1,.3,1) both' }}>
                  <div className="text-xs mb-[5px]">
                    <span className="text-[10.5px] text-(--text-2) font-bold tracking-[.01em] text-[rgba(251,191,36,0.75)]">Note</span>
                    <span className="text-[10px] text-(--text-3) ml-[7px] font-normal">{formatDate(note.created_at)}</span>
                  </div>
                  <div className="msg-note">
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
              if (e.key === 'Enter' && !e.shiftKey) handleAddNote()
            }}
            placeholder="Add an internal note..."
            className="flex-1 px-3 py-2 border border-[#FDE68A] rounded-lg text-[12.5px] text-(--text-1) bg-[rgba(251,191,36,0.04)] font-inherit outline-none transition-[border-color] duration-200"
          />
          <Button
            variant="outline"
            onClick={handleAddNote}
            disabled={addingNote || !noteInput.trim()}
            className={`px-3.5 py-2 rounded-lg border border-[#FDE68A] bg-[rgba(251,191,36,0.08)] text-[#F59E0B] text-xs font-semibold font-inherit transition-all duration-150 shrink-0 whitespace-nowrap ${addingNote || !noteInput.trim() ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {addingNote ? 'Adding...' : 'Add Note'}
          </Button>
        </div>
        <div ref={msgEndRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-border shrink-0 bg-(--bg-surface)">
        {/* Macro panel */}
        {showMacros && (
          <MacroPanel
            macros={macros.filter((m) => !m.archived)}
            aiMacros={aiMacros}
            customerName={extractName(selectedThread?.from || '')}
            favs={macroFavs}
            onToggleFav={toggleMacroFav}
            onInsert={(body) => {
              const safeBody = plainTextToSafeHtml(body)
              if (composerRef.current) {
                composerRef.current.innerHTML = safeBody
                setReply(composerRef.current.textContent)
              } else setReply(body)
              setShowMacros(false)
              setTimeout(() => composerRef.current?.focus(), 10)
            }}
            onClose={() => setShowMacros(false)}
            onManage={() => {
              setShowMacros(false)
              setShowMacroManager(true)
            }}
            onCreateNew={() => {
              setShowMacros(false)
              setShowMacroManager(true)
            }}
            onDeleteMacro={deleteMacro}
          />
        )}

        {/* Composer */}
        {!showMacros && (
          <>
            {/* Tab strip */}
            <div className="flex border-b border-border pl-4">
              {[
                { id: 'reply', label: 'Reply' },
                { id: 'note', label: 'Internal note' },
              ].map((t) => (
                <button key={t.id} className={`ctab${composerTab === t.id ? ' on' : ''}`} onClick={() => setComposerTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* To: row */}
            <div className="flex items-center gap-2 px-3.5 py-2 border-b border-border">
              <span className="flex text-(--text-3) shrink-0">
                <Mail size={14} />
              </span>
              <span className="text-[11.5px] text-(--text-2) font-semibold shrink-0">To:</span>
              <span className="flex-1 text-xs text-(--text-1) overflow-hidden text-ellipsis whitespace-nowrap">
                {extractName(selectedThread.from)}
                {extractEmail(selectedThread.from) ? ` (${extractEmail(selectedThread.from)})` : ''}
              </span>
              <ChevronDown size={11} className="text-(--text-3) shrink-0" />
            </div>

            {/* Macro search row */}
            <div
              className="flex items-center gap-2 px-3.5 py-[7px] border-b border-border cursor-pointer transition-[background] duration-[120ms] hover:bg-(--bg-surface-2)"
              onClick={() => setShowMacros(true)}
            >
              <span className="text-(--text-3) flex shrink-0">
                <Zap size={13} />
              </span>
              <span className="flex-1 text-xs text-(--text-3)">Search macros by name, tags or body...</span>
              {aiMacros.length > 0 && (
                <span className="text-[9px] font-bold px-1.5 py-px rounded bg-(--bg-surface-2) text-(--text-2) tracking-[.04em] shrink-0 border border-border">
                  AI
                </span>
              )}
              <ChevronDown size={11} className="text-(--text-3) shrink-0" />
            </div>

            {/* Hidden file inputs */}
            <input ref={imgUploadRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            <input ref={fileUploadRef} type="file" multiple className="hidden" onChange={handleFileAttach} />

            {/* Flat compose area */}
            <div className="compose-box bg-(--bg-surface)" onClick={() => showEmoji && setShowEmoji(false)}>
              {/* Auto-translate banner */}
              {autoTranslate && customerLang && customerLang.code !== 'en' && (
                <div className="flex items-center gap-2 px-3.5 py-1.5 bg-(--bg-surface-2) border-b border-(--border) text-[11.5px] text-(--text-2)">
                  <span className="flex">
                    <Globe size={13} />
                  </span>
                  <span className="flex-1">
                    Auto-translating to <strong>{customerLang.name}</strong>
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => setAutoTranslate(false)} className="text-(--text-3) flex p-0">
                    <X size={10} />
                  </Button>
                </div>
              )}

              {/* Attachments */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-[5px] pt-2 px-3.5 pb-0">
                  {attachments.map((a, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-[5px] px-2.5 py-1 bg-(--bg-surface-2) border border-(--border) rounded-lg text-[11px] text-(--text-2)"
                    >
                      <Paperclip size={13} /> {a.name}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                        className="text-(--text-3) flex p-0 ml-0.5"
                      >
                        <X size={10} />
                      </Button>
                    </span>
                  ))}
                </div>
              )}

              {/* Contenteditable composer */}
              <div
                ref={composerRef}
                contentEditable
                suppressContentEditableWarning
                data-placeholder={composerTab === 'reply' ? 'Click here to reply, or press r.' : 'Internal note — not visible to customer…'}
                onInput={(e) => setReply(e.currentTarget.textContent)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
                }}
                className={`compose-ta w-full resize-none outline-none bg-transparent px-4 py-3 text-sm text-(--text-1) leading-relaxed min-h-[90px] tracking-[.005em] min-h-[150px] ${composerTab === 'note' ? 'bg-[rgba(251,191,36,0.03)]' : 'bg-transparent'}`}
              />

              {/* AI generating dots */}
              {aiLoading && (
                <div className="pt-1 px-4 pb-0 flex items-center gap-1">
                  {[0, 0.18, 0.36].map((d) => (
                    <span
                      key={d}
                      className="w-[5px] h-[5px] rounded-full bg-(--text-3) block"
                      style={{ animation: `glowPulse .9s ease-in-out ${d}s infinite` }}
                    />
                  ))}
                </div>
              )}

              {/* Suggested macros */}
              {(aiMacros.length > 0 || macros.length > 0) && (
                <div className="flex items-center gap-1.5 px-3.5 py-1.5 border-t border-border flex-wrap">
                  <Radio size={12} className="text-(--text-3) shrink-0" />
                  <span className="text-[10.5px] text-(--text-2) font-semibold shrink-0">Suggested macros</span>
                  {(aiMacros.length > 0 ? aiMacros : macros).slice(0, 3).map((m) => {
                    const firstName = extractName(selectedThread?.from || '').split(' ')[0] || 'there'
                    const body = m.body.replace(/{{name}}/gi, firstName).replace(/{{firstname}}/gi, firstName)
                    return (
                      <button
                        key={m.id}
                        className="inline-flex items-center text-xs font-medium px-2.5 py-[3px] rounded-[5px] border border-black/[0.08] bg-(--bg-surface-2) text-(--text-2) cursor-pointer transition-all hover:border-(--border-hover) hover:text-(--text-1)"
                        onClick={() => {
                          if (composerRef.current) {
                            composerRef.current.innerHTML = body.replace(/\n/g, '<br>')
                            setReply(composerRef.current.textContent)
                          } else setReply(body)
                          setTimeout(() => composerRef.current?.focus(), 10)
                        }}
                      >
                        {m.name}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Toolbar + Send buttons — single bottom row */}
              <div className="flex items-center gap-px px-2.5 py-[7px] border-t border-border">
                <button
                  className="min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-(--text-3) transition-all hover:bg-(--bg-surface-2) hover:text-(--text-1)"
                  title="Bold (⌘B)"
                  onClick={() => formatDoc('bold')}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <span className="font-extrabold text-[13px]">B</span>
                </button>
                <button
                  className="min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-(--text-3) transition-all hover:bg-(--bg-surface-2) hover:text-(--text-1)"
                  title="Italic (⌘I)"
                  onClick={() => formatDoc('italic')}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <span className="italic text-[13px]">I</span>
                </button>
                <button
                  className="min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-(--text-3) transition-all hover:bg-(--bg-surface-2) hover:text-(--text-1)"
                  title="Underline (⌘U)"
                  onClick={() => formatDoc('underline')}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <span className="underline text-[13px]">U</span>
                </button>
                <div className="rtbar-sep" />
                <button
                  className="min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-(--text-3) transition-all hover:bg-(--bg-surface-2) hover:text-(--text-1)"
                  title="Insert link"
                  onClick={insertLink}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <Link2 size={13} />
                </button>
                <button
                  className="min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-(--text-3) transition-all hover:bg-(--bg-surface-2) hover:text-(--text-1)"
                  title="Insert image"
                  onClick={() => imgUploadRef.current?.click()}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <ImageIcon size={13} />
                </button>
                <div className="relative">
                  <button
                    className={`min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-(--text-3) transition-all hover:bg-(--bg-surface-2) hover:text-(--text-1)${showEmoji ? ' rton' : ''}`}
                    title="Emoji"
                    onClick={() => setShowEmoji(!showEmoji)}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <Smile size={13} />
                  </button>
                  {showEmoji && (
                    <div
                      className="absolute bottom-[calc(100%+8px)] left-[-8px] bg-(--bg-surface) backdrop-blur-[28px] border border-(--border) rounded-2xl p-2.5 z-[200] shadow-[0_24px_80px_rgba(0,0,0,0.2)] animate-[fadeUp_.16s_ease_both]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="grid grid-cols-7 gap-[2px]">
                        {EMOJIS.map((em) => (
                          <button
                            key={em}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-[17px] cursor-pointer bg-transparent transition-colors hover:bg-(--bg-surface-2)"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              insertEmoji(em)
                              setShowEmoji(false)
                            }}
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  className="min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-(--text-3) transition-all hover:bg-(--bg-surface-2) hover:text-(--text-1)"
                  title="Attach file"
                  onClick={() => fileUploadRef.current?.click()}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <Paperclip size={13} />
                </button>
                <div className="rtbar-sep" />
                <button
                  className={`min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-(--text-3) transition-all hover:bg-(--bg-surface-2) hover:text-(--text-1)${autoTranslate ? ' rton' : ''} gap-1 pl-1.5 pr-2 text-[11px] font-semibold min-w-auto`}
                  title={customerLang ? `Auto-translate to ${customerLang.name}` : 'Detect language'}
                  onClick={() => (customerLang ? setAutoTranslate(!autoTranslate) : null)}
                >
                  <Globe size={13} />
                  <span>{customerLang ? customerLang.name : 'Translate'}</span>
                </button>
                <div className="flex-1" />
                <Button
                  variant="outline"
                  className="h-8 px-3 text-[12.5px] font-semibold bg-(--bg-surface-2) border border-(--border) text-(--text-1) rounded-[7px] transition-all hover:bg-(--bg-input) hover:border-(--border-hover) hover:text-(--text-1) flex items-center gap-1.5 px-[13px] py-[7px]"
                  onClick={handleAiReply}
                  disabled={aiLoading || !messages.length}
                >
                  {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <span className="text-primary text-[13px] leading-none">✦</span>}
                  {aiLoading ? 'Generating…' : 'AI Reply'}
                </Button>
                <Button
                  className="px-[9px] py-[9px] text-[12.5px] font-semibold bg-[rgba(74,222,128,0.07)] border border-[rgba(74,222,128,0.2)] text-[rgba(74,222,128,0.75)] rounded-xl flex items-center gap-[5px] transition-all hover:bg-[rgba(74,222,128,0.13)] hover:border-[rgba(74,222,128,0.38)] hover:text-[#4ade80] ml-1.5"
                  onClick={handleSendResolve}
                  disabled={!reply.trim() || sending}
                >
                  <Check size={11} />
                  Send & Close
                </Button>
                <Button className="flex items-center gap-1.5 ml-1.5" onClick={handleSend} disabled={!reply.trim() || sending}>
                  {sending ? <Loader2 size={13} className="animate-spin text-white" /> : <Send size={13} />}
                  {sending ? 'Sending…' : 'Send'}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
