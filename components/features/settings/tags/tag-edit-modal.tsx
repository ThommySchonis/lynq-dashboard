'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useCreateTag, useUpdateTag } from '@/hooks/settings'
import { TAG_COLORS, TAG_PALETTE } from '@/lib/tags'
import type { Tag } from '@/types/settings'

interface TagEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tag: Tag | null // null = create, existing = edit
}

export function TagEditModal({ open, onOpenChange, tag }: TagEditModalProps) {
  const isNew = !tag
  const [name, setName] = useState(tag?.name ?? '')
  const [color, setColor] = useState(tag?.color ?? 'slate')
  const [nameError, setNameError] = useState<string | null>(null)

  const createTag = useCreateTag()
  const updateTag = useUpdateTag()
  const saving = createTag.isPending || updateTag.isPending

  // Reset form state when dialog opens with new data
  function handleOpenChange(next: boolean) {
    if (next) {
      setName(tag?.name ?? '')
      setColor(tag?.color ?? 'slate')
      setNameError(null)
    }
    onOpenChange(next)
  }

  async function handleSave() {
    setNameError(null)
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError('Name is required')
      return
    }
    if (trimmed.length > 40) {
      setNameError('Max 40 characters')
      return
    }

    const form = { name: trimmed, color }

    if (isNew) {
      createTag.mutate(form, {
        onSuccess: () => onOpenChange(false),
        onError: (err) => setNameError(err.message),
      })
    } else {
      updateTag.mutate(
        { id: tag.id, ...form },
        {
          onSuccess: () => onOpenChange(false),
          onError: (err) => setNameError(err.message),
        },
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>{isNew ? 'Create tag' : 'Edit tag'}</DialogTitle>
          <DialogDescription>
            {isNew
              ? 'Add a new tag to organize your content.'
              : 'Update the tag name or color.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="tag-name">
              Name
            </label>
            <Input
              id="tag-name"
              type="text"
              placeholder="e.g. urgent"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setName(e.target.value)
                if (nameError) setNameError(null)
              }}
              maxLength={40}
              autoFocus
              aria-invalid={!!nameError}
            />
            {nameError && (
              <p className="text-xs text-destructive">{nameError}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Color</label>
            <div className="grid grid-cols-9 gap-1.5">
              {TAG_COLORS.map((c) => {
                const p = TAG_PALETTE[c]
                const isSelected = color === c
                return (
                  <button
                    key={c}
                    type="button"
                    className={`flex h-7 w-7 items-center justify-center rounded-lg border-2 transition-transform hover:scale-105 ${
                      isSelected
                        ? 'border-foreground'
                        : 'border-transparent'
                    }`}
                    style={{ background: p.dot }}
                    onClick={() => setColor(c)}
                    aria-label={c}
                  >
                    {isSelected && (
                      <Check size={14} strokeWidth={2.5} className="text-white" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                Saving...
              </>
            ) : isNew ? (
              'Create tag'
            ) : (
              'Save changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
