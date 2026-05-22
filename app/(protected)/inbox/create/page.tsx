'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ChevronLeft,
  ChevronDown,
  X,
  Plus,
  Send,
  Link as LinkIcon,
  List,
  Search,
  AlertCircle,
  Mail,
  Clock,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { useComposeMacros, useEmailAccountInfo } from '@/hooks/inbox/use-inbox-data'
import { useComposeEmail } from '@/hooks/inbox/use-inbox-mutations'
import { useAuthStore } from '@/stores/auth'
import { sanitizeHtml, plainTextToSafeHtml, normalizeSafeUrl } from '@/lib/inbox-utils'
import type { ComposeMacro } from '@/lib/inbox-create-constants'
import { DEMO_RECENT, STATUS_COLOR, PRIORITY_OPTS, FALLBACK_MACROS } from '@/lib/inbox-create-constants'
import { ComposeAvatar } from '@/components/features/inbox/compose-avatar'

// ── Page ──
export default function CreateTicketPage() {
  const router = useRouter()

  // Hooks
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const { data: fetchedMacros } = useComposeMacros()
  const { data: accountInfo } = useEmailAccountInfo()
  const composeEmail = useComposeEmail()

  // Compose fields
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [showCC, setShowCC] = useState(false)
  const [cc, setCC] = useState('')
  const [bcc, setBcc] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const [macroSearch, setMacroSearch] = useState('')
  const [showMacroDD, setShowMacroDD] = useState(false)
  const [priority, setPriority] = useState('normal')

  const bodyRef = useRef<HTMLDivElement>(null)

  // Resolve macros: fetched > fallback
  const macros: ComposeMacro[] = (fetchedMacros?.length ? fetchedMacros : FALLBACK_MACROS) as ComposeMacro[]
  const liveMacros = macros.filter((m) => !m.archived)
  const macroHits = macroSearch
    ? liveMacros
        .filter((m) =>
          `${m.name}${m.body || ''}${(m.tags || []).join(' ')}`
            .toLowerCase()
            .includes(macroSearch.toLowerCase()),
        )
        .slice(0, 8)
    : []
  const suggested = liveMacros.slice(0, 5)

  // Focus body on mount
  useEffect(() => {
    const timer = setTimeout(() => bodyRef.current?.focus(), 160)
    return () => clearTimeout(timer)
  }, [])

  // Escape to go back
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') router.push('/inbox')
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [router])

  // Rich text commands (tech debt: uses document.execCommand)
  const fmt = useCallback((cmd: string) => {
    bodyRef.current?.focus()
    document.execCommand(cmd, false, undefined)
  }, [])

  const insertLink = useCallback(() => {
    const raw = prompt('URL:')
    const url = normalizeSafeUrl(raw)
    if (!url) {
      toast.error('Only http, https, or mailto links are allowed')
      return
    }
    bodyRef.current?.focus()
    document.execCommand('createLink', false, url)
  }, [])

  function applyMacro(m: ComposeMacro) {
    if (!bodyRef.current) return
    bodyRef.current.innerHTML = plainTextToSafeHtml(m.body || '')
    setBody(m.body || '')
    setMacroSearch('')
    setShowMacroDD(false)
    bodyRef.current.focus()
  }

  // Send
  async function doSend() {
    if (!to.trim()) {
      toast.error('Please enter a recipient email')
      return
    }

    // Demo mode (no provider connected)
    if (!accountInfo?.connected) {
      await new Promise((r) => setTimeout(r, 800))
      toast.success('Message sent!')
      setTimeout(() => router.push('/inbox'), 700)
      return
    }

    const safeBody = sanitizeHtml(bodyRef.current?.innerHTML || '')
    composeEmail.mutate(
      {
        to: [{ email: to.trim(), name: '' }],
        subject: subject.trim() || '(no subject)',
        bodyHtml: safeBody,
        bodyText: bodyRef.current?.innerText || '',
        cc: cc.trim() ? [{ email: cc.trim(), name: '' }] : undefined,
        bcc: bcc.trim() ? [{ email: bcc.trim(), name: '' }] : undefined,
      },
      {
        onSuccess: () => {
          toast.success('Message sent!')
          setTimeout(() => router.push('/inbox'), 700)
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to send')
        },
      },
    )
  }

  return (
    <div className="relative flex h-full overflow-hidden bg-background">
      {/* Aurora background (dark mode only) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="hidden dark:block absolute rounded-full animate-aurora-a" style={{ top: '-25%', left: '12%', width: 1000, height: 900, background: 'radial-gradient(ellipse,rgba(161,117,252,0.62) 0%,rgba(124,58,237,0.32) 38%,rgba(109,40,217,0.1) 60%,transparent 74%)', filter: 'blur(55px)' }} />
        <div className="hidden dark:block absolute rounded-full animate-aurora-d" style={{ top: '2%', left: '3%', width: 420, height: 420, background: 'radial-gradient(ellipse,rgba(139,92,246,0.55) 0%,rgba(109,40,217,0.22) 50%,transparent 72%)', filter: 'blur(42px)' }} />
        <div className="hidden dark:block absolute rounded-full animate-aurora-b" style={{ bottom: '10%', left: '30%', width: 500, height: 500, background: 'radial-gradient(ellipse,rgba(107,63,196,0.38) 0%,rgba(75,40,148,0.14) 48%,transparent 70%)', filter: 'blur(58px)', animationDirection: 'reverse' }} />
        <div className="hidden dark:block absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.018) 1px,transparent 1px)', backgroundSize: '72px 72px' }} />
      </div>

      {/* LEFT: Recent tickets panel */}
      <div className="relative z-[1] flex w-[308px] shrink-0 flex-col border-r border-border bg-card dark:border-white/[0.07] dark:bg-[rgba(10,4,28,0.52)] dark:backdrop-blur-[24px]">
        {/* Header */}
        <div className="shrink-0 border-b border-border px-3.5 pb-2.5 pt-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold tracking-tight text-foreground">Inbox</span>
              <span className="rounded border border-border bg-secondary px-1.5 py-px text-[10px] font-semibold text-foreground-2">
                New ticket
              </span>
            </div>
            <Button variant="outline" size="xs" onClick={() => router.push('/inbox')} className="gap-1 text-[11.5px] font-semibold">
              <ChevronLeft className="h-2.5 w-2.5" />
              Back
            </Button>
          </div>
          <div className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Recent tickets
          </div>
        </div>

        {/* Thread list (demo) */}
        <div className="flex-1 overflow-y-auto">
          {DEMO_RECENT.map((t) => (
            <div
              key={t.id}
              className="flex cursor-pointer items-start gap-[9px] border-b border-border px-3.5 py-2.5 transition-colors hover:bg-secondary"
            >
              <ComposeAvatar name={t.from} size={28} />
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center justify-between gap-1.5">
                  <span className="truncate text-[11.5px] font-semibold text-foreground">
                    {t.from}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{t.time}</span>
                </div>
                <div className="flex items-center gap-[5px]">
                  <span className={`h-[5px] w-[5px] shrink-0 rounded-full ${STATUS_COLOR[t.status]}`} />
                  <span className="truncate text-[11px] text-foreground-2">{t.subject}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border px-3.5 py-2.5">
          <div className="flex items-center gap-[5px] text-[11px] text-muted-foreground">
            <AlertCircle className="h-2.5 w-2.5" />
            Press Esc to return to inbox
          </div>
        </div>
      </div>

      {/* RIGHT: Compose area */}
      <div className="relative z-[1] flex flex-1 flex-col overflow-hidden border-l border-border bg-card dark:bg-[#160c35]">
        {/* Top bar */}
        <div className="shrink-0 border-b border-border">
          {/* Row 1: Subject + Priority + Search + Assign + Close */}
          <div className="flex items-center gap-2 px-4 py-2.5">
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="min-w-0 flex-1 border-none bg-transparent text-sm font-semibold text-foreground shadow-none placeholder:text-muted-foreground"
            />
            {/* Priority */}
            <Select value={priority} onValueChange={(v) => { if (v) setPriority(v) }}>
              <SelectTrigger size="sm" className="shrink-0 text-[11.5px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Customer search */}
            <div className="flex w-[210px] shrink-0 items-center gap-1.5 rounded-lg border border-border bg-input px-2.5 py-[5px]">
              <Search className="h-[11px] w-[11px] shrink-0 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                className="w-full border-none bg-transparent text-[11.5px] text-foreground shadow-none placeholder:text-muted-foreground"
              />
            </div>
            {/* Unassigned */}
            <Button variant="outline" size="xs" className="gap-[5px] text-[11.5px] text-foreground-2">
              Unassigned
              <ChevronDown className="h-2.5 w-2.5" />
            </Button>
            {/* Close */}
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => router.push('/inbox')}
              title="Close (Esc)"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-[15px] w-[15px]" />
            </Button>
          </div>

          {/* Row 2: Tags + metadata */}
          <div className="flex flex-wrap items-center gap-3.5 border-t border-border px-4 py-1.5 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-[5px] border border-(--accent-border) bg-(--accent-soft) px-2 py-px text-[11.5px] text-(--accent-text)"
                >
                  {t}
                  <button
                    onClick={() => setTags((p) => p.filter((x) => x !== t))}
                    className="flex text-muted-foreground"
                  >
                    <X className="h-[9px] w-[9px]" />
                  </button>
                </span>
              ))}
              <button
                onClick={() => setShowTagInput((v) => !v)}
                className="inline-flex items-center gap-[3px] text-[11.5px] text-foreground-2"
              >
                <Plus className="h-2.5 w-2.5" />
                Add tags
              </button>
              {showTagInput && (
                <Input
                  autoFocus
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                      setTags((p) => [...new Set([...p, tagInput.trim()])])
                      setTagInput('')
                      if (e.key === ',') e.preventDefault()
                    }
                    if (e.key === 'Escape') setShowTagInput(false)
                  }}
                  placeholder="tag name..."
                  className="h-auto w-[84px] rounded-none border-x-0 border-t-0 border-b border-(--border-hover) bg-transparent py-0 text-[11.5px] text-foreground shadow-none placeholder:text-muted-foreground"
                />
              )}
            </div>
            <div className="h-[13px] w-px shrink-0 bg-(--border)" />
            <span className="text-foreground-2">
              Contact reason:{' '}
              <button className="text-foreground-2 text-xs">+Add</button>
            </span>
            <div className="h-[13px] w-px shrink-0 bg-(--border)" />
            <span className="text-foreground-2">
              Product:{' '}
              <button className="text-foreground-2 text-xs">+Add</button>
            </span>
            <div className="h-[13px] w-px shrink-0 bg-(--border)" />
            <span className="text-foreground-2">
              Resolution:{' '}
              <button className="text-foreground-2 text-xs">+Add</button>
            </span>
          </div>
        </div>

        {/* Thread area (empty state) */}
        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 overflow-y-auto bg-secondary">
          <div className="max-w-[380px] rounded-[14px] border border-border bg-card p-4 px-[22px] text-center shadow-(--shadow-card)">
            <Send className="mx-auto mb-2 h-[22px] w-[22px] text-muted-foreground opacity-70" />
            <div className="mb-[5px] text-[13px] font-semibold text-foreground">
              New outgoing email
            </div>
            <div className="text-xs leading-[1.65] text-muted-foreground">
              Fill in the To field and write your message below.
              <br />
              When the customer replies, the thread appears here in the inbox automatically.
            </div>
          </div>
        </div>

        {/* Compose bottom */}
        <div className="shrink-0 border-t border-border bg-card dark:bg-[#120931]">
          {/* To */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-[9px]">
            <span className="w-10 shrink-0 text-[10.5px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
              To
            </span>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="customer@email.com"
              autoFocus
              className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-foreground shadow-none placeholder:text-muted-foreground"
            />
            <Button
              variant="outline"
              size="xs"
              onClick={() => setShowCC((v) => !v)}
              className={`px-[9px] text-[10.5px] font-semibold ${
                showCC
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              Cc / Bcc
            </Button>
          </div>

          {/* From */}
          {accountInfo?.email && (
            <div className="flex items-center gap-2 border-b border-border px-4 py-[9px]">
              <span className="w-10 shrink-0 text-[10.5px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
                From
              </span>
              <div className="flex items-center gap-1.5">
                <Mail className="h-[13px] w-[13px] text-muted-foreground" />
                <span className="text-[13px] text-foreground-2">{accountInfo.email}</span>
              </div>
            </div>
          )}

          {/* Demo mode warning */}
          {!accountInfo?.connected && (
            <div className="flex items-center gap-[7px] border-b border-border bg-amber-500/5 px-4 py-[7px] dark:bg-amber-400/[0.06]">
              <AlertCircle className="h-[11px] w-[11px] shrink-0 text-amber-600" />
              <span className="text-[11.5px] text-amber-600">
                Demo mode &mdash;{' '}
                <Link
                  href="/settings/integrations/email"
                  className="font-semibold text-foreground no-underline"
                >
                  connect Gmail or Outlook
                </Link>{' '}
                in Settings to send real emails
              </span>
            </div>
          )}

          {/* CC + BCC */}
          {showCC && (
            <div className="flex items-center gap-2 border-b border-border bg-input px-4 py-2">
              <span className="w-10 shrink-0 text-[10.5px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
                CC
              </span>
              <Input
                value={cc}
                onChange={(e) => setCC(e.target.value)}
                placeholder="cc@email.com"
                className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-foreground shadow-none placeholder:text-muted-foreground"
              />
              <span className="w-10 shrink-0 text-[10.5px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
                BCC
              </span>
              <Input
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                placeholder="bcc@email.com"
                className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-foreground shadow-none placeholder:text-muted-foreground"
              />
            </div>
          )}

          {/* Macro search */}
          <div className="relative flex items-center gap-2 border-b border-border px-4 py-[7px]">
            <Plus className="h-[13px] w-[13px] shrink-0 text-muted-foreground" />
            <Input
              value={macroSearch}
              onChange={(e) => {
                setMacroSearch(e.target.value)
                setShowMacroDD(true)
              }}
              onFocus={() => setShowMacroDD(true)}
              onBlur={() => setTimeout(() => setShowMacroDD(false), 160)}
              placeholder="Search macros by name, tags or body..."
              className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-foreground shadow-none placeholder:text-muted-foreground"
            />
            {macroSearch && (
              <button
                onMouseDown={(e) => {
                  e.preventDefault()
                  setMacroSearch('')
                  setShowMacroDD(false)
                }}
                className="flex text-muted-foreground"
              >
                <X className="h-[11px] w-[11px]" />
              </button>
            )}
            <ChevronDown className="h-[11px] w-[11px] text-muted-foreground" />

            {/* Macro dropdown */}
            {showMacroDD && macroHits.length > 0 && (
              <div className="absolute bottom-[calc(100%+4px)] left-0 right-0 z-[60] max-h-[220px] animate-[fadeUp_0.14s_ease_both] overflow-y-auto rounded-[10px] border border-border bg-card p-1 shadow-[0_-12px_32px_rgba(0,0,0,0.1)] dark:bg-[#1a0b3d] dark:shadow-[0_-12px_32px_rgba(0,0,0,0.4)]">
                {macroHits.map((m) => (
                  <button
                    key={m.id}
                    className="block w-full cursor-pointer rounded-[7px] border-none bg-none px-[11px] py-2 text-left transition-colors hover:bg-secondary"
                    onMouseDown={() => applyMacro(m)}
                  >
                    <div className="text-[12.5px] font-semibold text-foreground">
                      {m.name}
                    </div>
                    <div className="mt-px truncate text-[11.5px] text-foreground-2">
                      {m.body?.replace(/\n/g, ' ')}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Body (contenteditable rich text editor — tech debt) */}
          <div
            ref={bodyRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Type your message here... or pick a macro above."
            onInput={(e) => setBody(e.currentTarget.textContent || '')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void doSend()
            }}
            className="min-h-[120px] w-full resize-none overflow-y-auto border-none bg-transparent px-4 py-3.5 text-[13.5px] leading-[1.78] tracking-[0.005em] text-foreground outline-none empty:before:pointer-events-none empty:before:block empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
          />

          {/* Suggested macros */}
          {!body && suggested.length > 0 && (
            <div className="flex flex-wrap items-center gap-[7px] border-t border-border px-4 py-[7px] pb-[9px]">
              <Clock className="h-[11px] w-[11px] shrink-0 text-muted-foreground" />
              <span className="text-[11px] font-medium text-muted-foreground">Suggested macros</span>
              {suggested.map((m) => (
                <button
                  key={m.id}
                  onClick={() => applyMacro(m)}
                  className="rounded-full border border-border bg-card px-2.5 py-[2px] text-[11.5px] text-foreground shadow-(--shadow-row) transition-colors hover:border-(--border-hover)"
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}

          {/* Toolbar + Send */}
          <div className="flex items-center gap-0.5 border-t border-border px-3 py-2">
            <button
              className="flex h-[30px] min-w-[26px] items-center justify-center rounded-[7px] px-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => fmt('bold')}
              title="Bold"
            >
              B
            </button>
            <button
              className="flex h-[30px] min-w-[26px] items-center justify-center rounded-[7px] px-1.5 text-xs italic text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => fmt('italic')}
              title="Italic"
            >
              I
            </button>
            <button
              className="flex h-[30px] min-w-[26px] items-center justify-center rounded-[7px] px-1.5 text-xs text-muted-foreground underline transition-colors hover:bg-secondary hover:text-foreground"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => fmt('underline')}
              title="Underline"
            >
              U
            </button>
            <div className="mx-1 h-3.5 w-px bg-(--border)" />
            <button
              className="flex h-[30px] min-w-[30px] items-center justify-center rounded-[7px] px-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              onMouseDown={(e) => e.preventDefault()}
              onClick={insertLink}
              title="Link"
            >
              <LinkIcon className="h-3 w-3" />
            </button>
            <button
              className="flex h-[30px] min-w-[30px] items-center justify-center rounded-[7px] px-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => fmt('insertUnorderedList')}
              title="Bullet list"
            >
              <List className="h-3 w-3" />
            </button>
            <div className="flex-1" />
            <span className="mr-2 text-[10.5px] text-muted-foreground">Cmd+Enter to send</span>
            <div className="flex shrink-0 items-stretch overflow-hidden rounded-[9px] shadow-[0_2px_12px_rgba(124,92,252,0.35)]">
              <Button
                onClick={() => { void doSend() }}
                disabled={isSuspended || composeEmail.isPending}
                title={isSuspended ? 'Workspace is suspended' : undefined}
                className="gap-1.5 rounded-none bg-[linear-gradient(135deg,#7C5CFC_0%,#6d4af8_100%)] px-[18px] py-[7px] text-[12.5px] font-semibold text-white hover:opacity-90"
              >
                {composeEmail.isPending ? (
                  <>
                    <Loader2 className="h-[11px] w-[11px] animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-[11px] w-[11px]" />
                    Send
                  </>
                )}
              </Button>
              <div className="w-px shrink-0 bg-white/20" />
              <Button
                onClick={() => { void doSend() }}
                disabled={isSuspended || composeEmail.isPending}
                title={isSuspended ? 'Workspace is suspended' : undefined}
                className="gap-[5px] rounded-none bg-[linear-gradient(135deg,#7C5CFC_0%,#6d4af8_100%)] px-[18px] py-[7px] text-[12.5px] font-semibold text-white hover:opacity-90"
              >
                Send &amp; Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
