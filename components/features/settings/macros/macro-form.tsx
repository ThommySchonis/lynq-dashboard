'use client'

import { useRef, useState } from 'react'
import { Plus, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * Settings macro create/edit form (Figma node 809-16). A single card:
 * name + language, a boxed response editor (To: + B/I/U + variable chips +
 * textarea), tags, and a Cancel / Create footer. Separate from the inbox
 * `MacroEditor` which keeps its own design.
 */

interface MacroData {
  id?: string
  name?: string
  body?: string
  tags?: string[]
  language?: string
  [key: string]: unknown
}

const LANGUAGES = ['English', 'Dutch', 'German', 'French', 'Spanish', 'Italian', 'Portuguese']

const VARIABLES = [
  { label: 'Customer first name', value: '{{name}}' },
  { label: 'Order number', value: '{{order_number}}' },
  { label: 'Tracking link', value: '{{tracking_link}}' },
  { label: 'Agent name', value: '{{agent_name}}' },
]

interface MacroFormProps {
  macro: MacroData | null
  onSave: (m: MacroData) => void
  onCancel: () => void
  onDelete?: (id: string) => void
}

export function MacroForm({ macro, onSave, onCancel, onDelete }: MacroFormProps) {
  const isNew = !macro?.id
  const [name, setName] = useState(macro?.name ?? '')
  const [language, setLanguage] = useState(macro?.language ?? 'English')
  const [body, setBody] = useState(macro?.body ?? '')
  const [tagInput, setTagInput] = useState((macro?.tags ?? []).join(', '))
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  function insertVariable(value: string) {
    const ta = bodyRef.current
    if (!ta) {
      setBody((prev) => prev + value)
      return
    }
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const next = ta.value.slice(0, start) + value + ta.value.slice(end)
    setBody(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + value.length, start + value.length)
    })
  }

  function handleSave() {
    if (!name.trim()) return
    const tags = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    onSave({ ...macro, name: name.trim(), language, body: body.trim(), tags })
  }

  return (
    <div className="mx-auto w-full max-w-[960px] px-6 py-8">
      <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card px-8 py-[30px] shadow-[0_4px_14px_-4px_rgba(15,13,31,0.05)]">
        {/* Name + Language */}
        <div className="flex flex-col gap-6 sm:flex-row">
          <Field className="flex-1" label="Macro name" required hint="The name all agents see while searching for it." htmlFor="macro-name">
            <Input
              id="macro-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Delivery – Delay"
              className="h-11 rounded-[10px] bg-card px-3.5 text-sm"
            />
          </Field>

          <Field className="sm:w-[300px]" label="Language" hint="The language this macro is written in.">
            <Select value={language} onValueChange={(v) => v && setLanguage(v)}>
              <SelectTrigger className="h-11 w-full rounded-[10px] bg-card">
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
          </Field>
        </div>

        {/* Response text */}
        <Field label="Response text" required>
          <div className="overflow-hidden rounded-xl border border-border">
            {/* Recipient row */}
            <div className="flex items-center gap-2 bg-accent-soft/50 px-3.5 py-2.5">
              <span className="text-xs text-muted-foreground">To:</span>
              <span className="flex items-center gap-1.5 rounded-lg border border-border bg-card py-1.5 pl-3.5 pr-2 text-xs text-foreground-2">
                Current client
                <ChevronDown size={12} strokeWidth={2} className="text-muted-foreground" />
              </span>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 border-t border-border px-3.5 py-2.5">
              {['B', 'I', 'U'].map((f) => (
                <span
                  key={f}
                  className={[
                    'flex size-[30px] items-center justify-center rounded-[7px] border border-border bg-card text-sm text-foreground-2',
                    f === 'B' ? 'font-bold' : f === 'I' ? 'italic font-bold' : 'underline',
                  ].join(' ')}
                >
                  {f}
                </span>
              ))}
              <span className="mx-1 h-5 w-px bg-border" />
              {VARIABLES.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => insertVariable(v.value)}
                  className="flex items-center gap-1.5 rounded-lg bg-foreground/[0.04] py-1.5 pl-2.5 pr-3 text-xs text-foreground transition-colors hover:bg-foreground/[0.07]"
                >
                  <Plus size={11} strokeWidth={2} className="text-muted-foreground" />
                  {v.label}
                </button>
              ))}
            </div>

            {/* Body */}
            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your macro response here. Use the variable chips above to insert dynamic values."
              className="min-h-[230px] w-full resize-y border-t border-border bg-card px-4 py-3.5 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
        </Field>

        {/* Tags */}
        <Field
          label="Tags"
          labelExtra="(comma separated)"
          hint="Add tags to group and filter macros."
          htmlFor="macro-tags"
        >
          <Input
            id="macro-tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="e.g. shipping, support"
            className="h-11 rounded-[10px] bg-card px-3.5 text-sm"
          />
        </Field>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-6">
          <div>
            {!isNew && onDelete && macro?.id && (
              <Button
                variant="outline"
                onClick={() => onDelete(macro.id!)}
                className="text-destructive hover:text-destructive"
              >
                Delete macro
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              <Plus size={16} strokeWidth={1.75} />
              {isNew ? 'Create macro' : 'Update macro'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface FieldProps {
  label: string
  required?: boolean
  labelExtra?: string
  hint?: string
  htmlFor?: string
  className?: string
  children: React.ReactNode
}

function Field({ label, required, labelExtra, hint, htmlFor, className, children }: FieldProps) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ''}`}>
      <label htmlFor={htmlFor} className="flex items-center gap-1 text-sm font-semibold text-foreground">
        {label}
        {required && <span className="text-destructive">*</span>}
        {labelExtra && <span className="font-medium text-muted-foreground">{labelExtra}</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
