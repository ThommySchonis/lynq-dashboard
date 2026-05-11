'use client'

import {
  forwardRef,
  useImperativeHandle,
  useState,
  useRef,
  useCallback,
} from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold,
  Italic,
  Underline,
  Link2,
  ImageIcon,
  Smile,
  Zap,
  Sparkles,
  Send,
  Paperclip,
  X,
  Languages,
  Check,
  Loader2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import { EMOJIS } from '@/lib/inbox-utils'
import { useAI } from '@/hooks/inbox/use-ai'
import { useAIStore } from '@/stores/ai'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComposerHandle {
  insertContent: (html: string) => void
  focus: () => void
}

interface ComposerProps {
  threadId: string
  threadEmail: string
  onSend: (html: string) => Promise<boolean>
  onSendResolve: (html: string) => Promise<void>
  onMacroTrigger: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const Composer = forwardRef<ComposerHandle, ComposerProps>(
  function Composer({ threadId, threadEmail, onSend, onSendResolve, onMacroTrigger }, ref) {
    // ----- state -----------------------------------------------------------
    const [composerTab, setComposerTab] = useState<'reply' | 'note'>('reply')
    const [attachments, setAttachments] = useState<{ name: string; size: number }[]>([])
    const [sending, setSending] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const imgInputRef = useRef<HTMLInputElement>(null)

    // ----- AI --------------------------------------------------------------
    const ai = useAI()
    const customerLang = useAIStore((s) => s.customerLang)
    const autoTranslate = useAIStore((s) => s.autoTranslate)
    const setAutoTranslate = useAIStore((s) => s.setAutoTranslate)
    const aiLoading = useAIStore((s) => s.aiLoading)

    // ----- Tiptap editor ---------------------------------------------------
    const editor = useEditor({
      immediatelyRender: false,
      extensions: [
        StarterKit,
        Link.configure({ openOnClick: false }),
        Image,
        Placeholder.configure({
          placeholder:
            composerTab === 'reply'
              ? 'Click here to reply, or press r.'
              : 'Internal note — not visible to customer\u2026',
        }),
      ],
      content: '',
      editorProps: {
        attributes: {
          class:
            'prose prose-sm prose-invert max-w-none min-h-[150px] px-3.5 py-3 outline-none text-sm leading-relaxed text-foreground',
        },
        handleKeyDown: (_view, event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            handleSend()
            return true
          }
          return false
        },
      },
    })

    // ----- imperative handle -----------------------------------------------
    useImperativeHandle(ref, () => ({
      insertContent(html: string) {
        editor?.commands.setContent(html)
      },
      focus() {
        editor?.commands.focus()
      },
    }))

    // ----- helpers ---------------------------------------------------------
    const hasContent = useCallback(() => {
      if (!editor) return false
      return editor.getText().trim().length > 0
    }, [editor])

    // ----- actions ---------------------------------------------------------
    async function handleSend() {
      if (!hasContent() || sending || !editor) return
      setSending(true)
      try {
        const ok = await onSend(editor.getHTML())
        if (ok) {
          editor.commands.clearContent()
          setAttachments([])
        }
      } finally {
        setSending(false)
      }
    }

    async function handleSendResolve() {
      if (!hasContent() || sending || !editor) return
      setSending(true)
      try {
        await onSendResolve(editor.getHTML())
        editor.commands.clearContent()
        setAttachments([])
      } finally {
        setSending(false)
      }
    }

    async function handleAiReply() {
      if (aiLoading || !editor) return
      // ai.reply needs thread + messages — parent should provide via store
      // For now we call the store directly; the hook reads from the inbox store
      const result = await ai.reply(
        { id: threadId } as Parameters<typeof ai.reply>[0],
        [] as Parameters<typeof ai.reply>[1],
      )
      if (result) {
        editor.commands.setContent(result)
      }
    }

    function handleInsertLink() {
      const url = window.prompt('Enter URL:')
      if (!url) return
      try {
        const parsed = new URL(url)
        if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return
        editor?.chain().focus().setLink({ href: parsed.href }).run()
      } catch {
        // invalid URL
      }
    }

    function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0]
      if (!file || !editor) return
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          editor.chain().focus().setImage({ src: reader.result }).run()
        }
      }
      reader.readAsDataURL(file)
      e.target.value = ''
    }

    function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>) {
      const files = e.target.files
      if (!files) return
      const newAttachments = Array.from(files).map((f) => ({
        name: f.name,
        size: f.size,
      }))
      setAttachments((prev) => [...prev, ...newAttachments])
      e.target.value = ''
    }

    function removeAttachment(index: number) {
      setAttachments((prev) => prev.filter((_, i) => i !== index))
    }

    // ----- render ----------------------------------------------------------
    return (
      <div className="flex flex-col border-t border-border bg-background">
        {/* Tab bar */}
        <Tabs
          value={composerTab}
          onValueChange={(v) => setComposerTab(v as 'reply' | 'note')}
        >
          <TabsList variant="line" className="h-9 w-full justify-start rounded-none border-b border-border bg-transparent px-4">
            <TabsTrigger value="reply" className="text-xs font-semibold">
              Reply
            </TabsTrigger>
            <TabsTrigger value="note" className="text-xs font-semibold">
              Internal note
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* To: row */}
        <div className="flex items-center gap-2 border-b border-border px-3.5 py-2">
          <span className="text-[11.5px] font-semibold text-muted-foreground shrink-0">
            To:
          </span>
          <span className="flex-1 truncate text-xs text-foreground">
            {threadEmail}
          </span>
        </div>

        {/* Auto-translate banner */}
        {autoTranslate && customerLang && customerLang.code !== 'en' && (
          <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3.5 py-1.5 text-xs text-muted-foreground">
            <Languages className="size-3.5 shrink-0" />
            <span className="flex-1">
              Auto-translating to <strong className="text-foreground">{customerLang.name}</strong>
            </span>
            <button
              onClick={() => setAutoTranslate(false)}
              className="flex shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </div>
        )}

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-border px-3.5 py-2">
            {attachments.map((a, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                <Paperclip className="size-3 shrink-0" />
                {a.name}
                <button
                  onClick={() => removeAttachment(i)}
                  className="ml-0.5 flex text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Tiptap editor */}
        <div
          className={
            composerTab === 'note'
              ? 'bg-amber-500/[0.03]'
              : 'bg-transparent'
          }
        >
          <EditorContent editor={editor} />
        </div>

        {/* AI loading indicator */}
        {aiLoading && (
          <div className="flex items-center gap-1 px-4 py-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="block size-1.5 animate-pulse rounded-full bg-muted-foreground"
                style={{ animationDelay: `${i * 180}ms` }}
              />
            ))}
          </div>
        )}

        {/* Toolbar + action bar */}
        <div className="flex items-center gap-0.5 border-t border-border bg-muted/20 px-2.5 py-1.5">
          {/* Formatting buttons */}
          <Button
            variant="ghost"
            size="icon-xs"
            title="Bold (Ctrl+B)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            title="Italic (Ctrl+I)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            title="Underline (Ctrl+U)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          >
            <Underline className="size-3.5" />
          </Button>

          <div className="mx-1.5 h-4 w-px shrink-0 bg-border" />

          <Button
            variant="ghost"
            size="icon-xs"
            title="Insert link"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleInsertLink}
          >
            <Link2 className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            title="Insert image"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => imgInputRef.current?.click()}
          >
            <ImageIcon className="size-3.5" />
          </Button>

          {/* Emoji picker */}
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Emoji"
                  onMouseDown={(e) => e.preventDefault()}
                />
              }
            >
              <Smile className="size-3.5" />
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              className="w-64 p-2"
            >
              <div className="grid grid-cols-8 gap-0.5">
                {EMOJIS.map((em) => (
                  <button
                    key={em}
                    className="flex size-8 items-center justify-center rounded text-base hover:bg-muted"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      editor?.commands.insertContent(em)
                    }}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="icon-xs"
            title="Attach file"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="size-3.5" />
          </Button>

          <div className="mx-1.5 h-4 w-px shrink-0 bg-border" />

          {/* Translation toggle */}
          <Button
            variant="ghost"
            size="xs"
            title={
              customerLang
                ? `Auto-translate to ${customerLang.name}`
                : 'Detect language'
            }
            className={autoTranslate ? 'bg-muted text-foreground' : ''}
            onClick={() => customerLang && setAutoTranslate(!autoTranslate)}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Languages className="size-3.5" />
            <span className="text-[11px] font-semibold">
              {customerLang ? customerLang.name : 'Translate'}
            </span>
          </Button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Macro trigger */}
          <Button
            variant="ghost"
            size="icon-xs"
            title="Macros"
            onClick={onMacroTrigger}
          >
            <Zap className="size-3.5" />
          </Button>

          {/* AI Reply */}
          <Button
            variant="ghost"
            size="xs"
            disabled={aiLoading}
            onClick={handleAiReply}
            className="gap-1"
          >
            {aiLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5 text-primary" />
            )}
            <span className="text-[11px] font-semibold">
              {aiLoading ? 'Generating\u2026' : 'AI Reply'}
            </span>
          </Button>

          {/* Send & Resolve */}
          <Button
            variant="secondary"
            size="xs"
            disabled={!hasContent() || sending}
            onClick={handleSendResolve}
            className="ml-1.5 gap-1"
          >
            <Check className="size-3" />
            <span className="text-[11px] font-semibold">Send & Close</span>
          </Button>

          {/* Send */}
          <Button
            variant="default"
            size="xs"
            disabled={!hasContent() || sending}
            onClick={handleSend}
            className="ml-1.5 gap-1"
          >
            {sending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            <span className="text-[11px] font-semibold">
              {sending ? 'Sending\u2026' : 'Send'}
            </span>
          </Button>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={imgInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileAttach}
        />
      </div>
    )
  },
)
