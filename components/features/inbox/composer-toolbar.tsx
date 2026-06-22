'use client'

import { Button } from '@/components/ui/button'
import {
  Check,
  Globe,
  ImageIcon,
  Link2,
  Loader2,
  Paperclip,
  Send,
  Smile,
} from 'lucide-react'
import { EMOJIS } from '@/lib/inbox-utils'
import { useInboxUI } from '@/stores/inbox-ui'
import { useAIStore } from '@/stores/ai'
import { useMacrosStore } from '@/stores/macros'
import { useSubscription } from '@/hooks/billing'

interface ComposerToolbarProps {
  onFormatDoc: (cmd: string) => void
  onInsertLink: () => void
  onImageUpload: () => void
  onFileAttach: () => void
  onInsertEmoji: (emoji: string) => void
  onAiReply: () => void
  onSend: () => void
  onSendResolve: () => void
  /** Pass false when there are no messages to reply to (disables AI Reply) */
  hasMessages: boolean
  /** When true, disables send/resolve buttons (workspace is suspended) */
  disabled?: boolean
}

// Formatting controls (B/I/U, link, image, emoji, attach, translate) aren't in
// the Figma composer (1283-52943). Hidden behind this flag so the client can
// restore them; typed `boolean` to keep dead-branch checks quiet.
const SHOW_FORMATTING: boolean = false

export function ComposerToolbar({
  onFormatDoc,
  onInsertLink,
  onImageUpload,
  onFileAttach,
  onInsertEmoji,
  onAiReply,
  onSend,
  onSendResolve,
  hasMessages,
  disabled = false,
}: ComposerToolbarProps) {
  const showEmoji = useInboxUI((s) => s.showEmoji)
  const setShowEmoji = useInboxUI((s) => s.setShowEmoji)
  const reply = useInboxUI((s) => s.reply)
  const sending = useInboxUI((s) => s.sending)

  const aiLoading = useAIStore((s) => s.aiLoading)
  const customerLang = useAIStore((s) => s.customerLang)
  const autoTranslate = useAIStore((s) => s.autoTranslate)
  const setAutoTranslate = useAIStore((s) => s.setAutoTranslate)

  const _aiMacros = useMacrosStore((s) => s.aiMacros)

  // Model 3 (forced upgrade) — refuse outbound when the plan limit is reached.
  // We derive this from the subscription response blocked flags, which mirror
  // the server-side checkTicketLimit so the UI stays in sync.
  const { data: subData } = useSubscription()
  const planLocked = subData?.blocked?.tickets === true
  const sendDisabledReason = planLocked
    ? 'Upgrade your plan to send more replies'
    : undefined

  return (
    <div className="flex items-center gap-px px-2.5 py-[7px] border-t border-border">
      {SHOW_FORMATTING && (
       <>
      <button
        className="min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
        title="Bold (⌘B)"
        onClick={() => onFormatDoc('bold')}
        onMouseDown={(e) => e.preventDefault()}
      >
        <span className="font-extrabold text-[13px]">B</span>
      </button>
      <button
        className="min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
        title="Italic (⌘I)"
        onClick={() => onFormatDoc('italic')}
        onMouseDown={(e) => e.preventDefault()}
      >
        <span className="italic text-[13px]">I</span>
      </button>
      <button
        className="min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
        title="Underline (⌘U)"
        onClick={() => onFormatDoc('underline')}
        onMouseDown={(e) => e.preventDefault()}
      >
        <span className="underline text-[13px]">U</span>
      </button>
      <div className="w-px h-[18px] bg-secondary mx-1.5 shrink-0" />
      <button
        className="min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
        title="Insert link"
        onClick={onInsertLink}
        onMouseDown={(e) => e.preventDefault()}
      >
        <Link2 size={13} />
      </button>
      <button
        className="min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
        title="Insert image"
        onClick={onImageUpload}
        onMouseDown={(e) => e.preventDefault()}
      >
        <ImageIcon size={13} />
      </button>
      <div className="relative">
        <button
          className={`min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-muted-foreground transition-all hover:bg-secondary hover:text-foreground${showEmoji ? ' rton' : ''}`}
          title="Emoji"
          onClick={() => setShowEmoji(!showEmoji)}
          onMouseDown={(e) => e.preventDefault()}
        >
          <Smile size={13} />
        </button>
        {showEmoji && (
          <div
            className="absolute bottom-[calc(100%+8px)] left-[-8px] bg-card backdrop-blur-[28px] border border-border rounded-2xl p-2.5 z-[200] shadow-[0_24px_80px_rgba(0,0,0,0.2)] animate-[fadeUp_.16s_ease_both]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-7 gap-[2px]">
              {EMOJIS.map((em) => (
                <button
                  key={em}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[17px] cursor-pointer bg-transparent transition-colors hover:bg-secondary"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onInsertEmoji(em)
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
        className="min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
        title="Attach file"
        onClick={onFileAttach}
        onMouseDown={(e) => e.preventDefault()}
      >
        <Paperclip size={13} />
      </button>
      <div className="w-px h-[18px] bg-secondary mx-1.5 shrink-0" />
      <button
        className={`min-w-[30px] h-[30px] flex items-center justify-center rounded-[7px] cursor-pointer text-xs font-bold text-muted-foreground transition-all hover:bg-secondary hover:text-foreground${autoTranslate ? ' rton' : ''} gap-1 pl-1.5 pr-2 text-[11px] font-semibold min-w-auto`}
        title={customerLang ? `Auto-translate to ${customerLang.name}` : 'Detect language'}
        onClick={() => (customerLang ? setAutoTranslate(!autoTranslate) : null)}
      >
        <Globe size={13} />
        <span>{customerLang ? customerLang.name : 'Translate'}</span>
      </button>
       </>
      )}
      <div className="flex-1" />
      <span className="shrink-0 text-[11px] text-foreground-4 mr-1">Press R to reply</span>
      {/* AI Reply — accent-soft tint + primary text (Figma 1283-52943) */}
      <Button
        className="h-9 flex items-center gap-1.5 px-3.5 text-[12.5px] font-semibold bg-accent-soft border border-accent-border text-primary rounded-[10px] transition-opacity hover:opacity-90"
        onClick={onAiReply}
        disabled={aiLoading || !hasMessages}
      >
        {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <span className="text-[13px] leading-none">✦</span>}
        {aiLoading ? 'Generating…' : 'AI Reply'}
      </Button>
      {/* Send — solid dark */}
      <Button
        className="h-9 flex items-center gap-1.5 px-4 ml-1.5 text-[12.5px] font-semibold bg-foreground text-background rounded-[10px] transition-opacity hover:opacity-90"
        onClick={onSend}
        disabled={disabled || !reply.trim() || sending || planLocked}
        title={disabled ? 'Workspace is suspended' : sendDisabledReason}
      >
        {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        {planLocked ? 'Upgrade to send' : sending ? 'Sending…' : 'Send'}
      </Button>
      {/* Send & Close — outline */}
      <Button
        className="h-9 flex items-center gap-1.5 px-4 ml-1.5 text-[12.5px] font-semibold bg-card border border-foreground text-foreground rounded-[10px] transition-colors hover:bg-secondary"
        onClick={onSendResolve}
        disabled={disabled || !reply.trim() || sending || planLocked}
        title={disabled ? 'Workspace is suspended' : sendDisabledReason}
      >
        <Check size={11} />
        Send &amp; Close
      </Button>
    </div>
  )
}
