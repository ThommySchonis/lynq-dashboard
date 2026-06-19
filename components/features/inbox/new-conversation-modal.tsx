'use client'

import { useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import {
  Loader2, Mail, X, Bold, Italic, Underline, Link2, List, ListOrdered, MessageSquareText,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { sanitizeHtml, plainTextToSafeHtml, parseRecipientList } from '@/lib/inbox-utils'
import { useStoreStore } from '@/stores/store'
import { useEmailAccountsForStore, useComposeMacros } from '@/hooks/inbox'
import { useComposeEmail } from '@/hooks/inbox/use-inbox-mutations'

const schema = z.object({
  accountId: z.string().min(1, 'Select an inbox'),
  subject: z.string().min(1, 'Subject is required'),
  to: z.string().min(1, 'At least one recipient is required'),
  cc: z.string().optional(),
  bcc: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface NewConversationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * "New conversation" compose modal (Figma 332-28942 / 313-3892). Opened from the
 * sidebar's "New message" action. Reuses useComposeEmail for sending.
 */
export function NewConversationModal({ open, onOpenChange }: NewConversationModalProps) {
  const activeStoreId = useStoreStore((s) => s.activeStoreId)
  // Only fetch while the modal is open — it stays mounted in the sidebar otherwise.
  const { data: accounts = [] } = useEmailAccountsForStore(activeStoreId, open)
  const { data: macros = [] } = useComposeMacros(open)
  const compose = useComposeEmail()

  const bodyRef = useRef<HTMLDivElement>(null)
  const [bodyEmpty, setBodyEmpty] = useState(true)
  const [bodyError, setBodyError] = useState<string | null>(null)
  const [showBcc, setShowBcc] = useState(false)

  const {
    register, handleSubmit, control, reset, setValue, getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { accountId: '', subject: '', to: '', cc: '', bcc: '' },
  })

  // Default the inbox to the first available account once they load.
  useEffect(() => {
    if (accounts.length > 0 && !getValues('accountId')) {
      setValue('accountId', accounts[0].id)
    }
  }, [accounts, getValues, setValue])

  function syncBodyEmpty() {
    setBodyEmpty(!bodyRef.current?.textContent?.trim())
  }

  function fmt(cmd: string, value?: string) {
    bodyRef.current?.focus()
    document.execCommand(cmd, false, value)
    syncBodyEmpty()
  }

  function insertLink() {
    const url = window.prompt('Link URL')
    if (url) fmt('createLink', url)
  }

  function insertMacro(body: string) {
    if (!bodyRef.current) return
    bodyRef.current.innerHTML = plainTextToSafeHtml(body)
    setBodyError(null)
    syncBodyEmpty()
  }

  function close() {
    reset()
    setShowBcc(false)
    setBodyError(null)
    setBodyEmpty(true)
    if (bodyRef.current) bodyRef.current.innerHTML = ''
    onOpenChange(false)
  }

  async function onSubmit(data: FormData) {
    const text = bodyRef.current?.textContent?.trim() ?? ''
    if (!text) {
      setBodyError('Message is required')
      return
    }
    await compose.mutateAsync(
      {
        accountId: data.accountId,
        to: parseRecipientList(data.to),
        cc: parseRecipientList(data.cc),
        bcc: parseRecipientList(data.bcc),
        subject: data.subject.trim(),
        bodyHtml: sanitizeHtml(bodyRef.current?.innerHTML ?? ''),
        bodyText: text,
      },
      {
        onSuccess: () => {
          toast.success('Message sent!')
          close()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to send')
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close() }}>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100%-2rem)] max-w-[660px] gap-0 overflow-hidden rounded-2xl p-0 shadow-[0_20px_48px_rgba(28,15,54,0.35)] sm:max-w-[660px]"
      >
        <DialogDescription className="sr-only">Compose and send a new email conversation.</DialogDescription>
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-background py-[18px] pl-6 pr-[18px]">
            <DialogTitle className="text-base font-bold tracking-[-0.01em] text-foreground">
              New conversation
            </DialogTitle>
            <DialogClose
              className="flex size-11 items-center justify-center rounded-md text-foreground-3 transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-5" />
            </DialogClose>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-[18px] px-6 py-[22px]">
            {/* Via inbox */}
            <Field label="Via inbox" required error={errors.accountId?.message}>
              <Controller
                control={control}
                name="accountId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v ?? '')}>
                    <SelectTrigger className="h-11 w-full rounded-[10px] border-border bg-card px-3.5">
                      <span className="flex items-center gap-2.5">
                        <Mail className="size-5 shrink-0 text-foreground-3" />
                        <SelectValue placeholder="Select inbox">
                          {(value: string | null) =>
                            accounts.find((a) => a.id === value)?.email_address ?? 'Select inbox'
                          }
                        </SelectValue>
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id} label={a.email_address}>
                          {a.email_address}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            {/* Subject */}
            <Field label="Subject" required error={errors.subject?.message}>
              <input
                placeholder="Enter subject name"
                className="h-11 w-full rounded-[10px] border border-border bg-card px-3.5 text-sm text-foreground outline-none transition-colors placeholder:text-foreground-4 focus:border-border-hover"
                {...register('subject')}
              />
            </Field>

            {/* To / Cc / Bcc + toolbar + body composer */}
            <div className="flex flex-col rounded-[10px] border border-border bg-card">
              <RecipientRow label="To:" placeholder="Type name or email" {...register('to')} />
              <RecipientRow
                label="Cc:"
                placeholder="Type name or email"
                trailing={
                  !showBcc && (
                    <button
                      type="button"
                      onClick={() => setShowBcc(true)}
                      className="shrink-0 text-sm font-semibold text-primary"
                    >
                      Bcc
                    </button>
                  )
                }
                {...register('cc')}
              />
              {showBcc && <RecipientRow label="Bcc:" placeholder="Type name or email" {...register('bcc')} />}

              {/* Formatting toolbar */}
              <div className="flex items-center justify-between gap-3 border-b border-border px-3.5 py-2.5">
                <Popover>
                  <PopoverTrigger
                    render={
                      <button
                        type="button"
                        className="flex items-center gap-1.5 text-sm text-foreground-3 transition-colors hover:text-foreground"
                      />
                    }
                  >
                    <MessageSquareText className="size-4" />
                    Canned response
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72 p-1">
                    {macros.length === 0 ? (
                      <p className="px-2 py-3 text-center text-xs text-foreground-3">No macros yet</p>
                    ) : (
                      <ul className="max-h-64 overflow-y-auto">
                        {macros.map((m) => (
                          <li key={m.id}>
                            <button
                              type="button"
                              onClick={() => insertMacro(m.body ?? '')}
                              className="w-full truncate rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                            >
                              {m.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </PopoverContent>
                </Popover>

                <div className="flex items-center gap-0.5 text-foreground-3">
                  <ToolbarButton label="Bold" onClick={() => fmt('bold')}><Bold className="size-4" /></ToolbarButton>
                  <ToolbarButton label="Italic" onClick={() => fmt('italic')}><Italic className="size-4" /></ToolbarButton>
                  <ToolbarButton label="Underline" onClick={() => fmt('underline')}><Underline className="size-4" /></ToolbarButton>
                  <ToolbarButton label="Link" onClick={insertLink}><Link2 className="size-4" /></ToolbarButton>
                  <ToolbarButton label="Bulleted list" onClick={() => fmt('insertUnorderedList')}><List className="size-4" /></ToolbarButton>
                  <ToolbarButton label="Numbered list" onClick={() => fmt('insertOrderedList')}><ListOrdered className="size-4" /></ToolbarButton>
                </div>
              </div>

              {/* Body */}
              <div className="relative">
                {bodyEmpty && (
                  <span className="pointer-events-none absolute left-3.5 top-3.5 text-sm text-foreground-4">
                    Type your message…
                  </span>
                )}
                <div
                  ref={bodyRef}
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-label="Message body"
                  onInput={syncBodyEmpty}
                  className="min-h-[180px] w-full rounded-b-[10px] p-3.5 text-sm text-foreground outline-none [&_a]:text-primary [&_a]:underline"
                />
              </div>
            </div>
            {(errors.to || bodyError) && <ErrorText message={errors.to?.message ?? bodyError ?? undefined} />}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 border-t border-border px-6 pb-[18px] pt-4">
            <Button type="button" variant="outline" onClick={close} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
              {isSubmitting ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label, required, error, children,
}: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-1 text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive">*</span>}
      </span>
      {children}
      {error && <ErrorText message={error} />}
    </div>
  )
}

function ErrorText({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-destructive">{message}</p>
}

function ToolbarButton({
  label, onClick, children,
}: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  )
}

function RecipientRow({
  label, trailing, ...inputProps
}: { label: string; trailing?: React.ReactNode } & React.ComponentProps<'input'>) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-3.5 py-3">
      <span className="text-sm font-semibold text-foreground-3">{label}</span>
      <input
        {...inputProps}
        className={cn(
          'flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-foreground-4',
        )}
      />
      {trailing}
    </div>
  )
}
