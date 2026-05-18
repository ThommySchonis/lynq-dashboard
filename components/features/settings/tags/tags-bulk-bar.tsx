'use client'

import { useState } from 'react'
import { GitMerge, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSettingsUI } from '@/stores/settings-ui'
import { useDeleteTag } from '@/hooks/settings'
import { ConfirmDialog } from '@/components/features/settings/confirm-dialog'
import { TagMergeModal } from './tag-merge-modal'
import type { Tag } from '@/types/settings'

interface TagsBulkBarProps {
  tags: Tag[]
  canDelete: boolean
}

export function TagsBulkBar({ tags, canDelete }: TagsBulkBarProps) {
  const selectedTagIds = useSettingsUI((s) => s.selectedTagIds)
  const clearTagSelection = useSettingsUI((s) => s.clearTagSelection)

  const [showMerge, setShowMerge] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const deleteTag = useDeleteTag()

  const count = selectedTagIds.size
  if (count === 0) return null

  const selectedTags = tags.filter((t) => selectedTagIds.has(t.id))

  async function handleBulkDelete() {
    const ids = Array.from(selectedTagIds)
    for (const id of ids) {
      deleteTag.mutate(id)
    }
    setShowDeleteConfirm(false)
    clearTagSelection()
  }

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2 text-sm">
        <span>
          <strong>{count}</strong> selected
        </span>
        <div className="ml-auto flex items-center gap-2">
          {count >= 2 && canDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMerge(true)}
            >
              <GitMerge size={14} strokeWidth={1.75} />
              Merge
            </Button>
          )}
          {canDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 size={14} strokeWidth={1.75} />
              Delete
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={clearTagSelection}
            aria-label="Clear selection"
          >
            <X size={14} strokeWidth={1.75} />
          </Button>
        </div>
      </div>

      <TagMergeModal
        open={showMerge}
        onOpenChange={(open) => {
          setShowMerge(open)
          if (!open) clearTagSelection()
        }}
        tags={selectedTags}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={`Delete ${count} tag${count === 1 ? '' : 's'}?`}
        description={`This will permanently delete ${count} tag${count === 1 ? '' : 's'}. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteTag.isPending}
        onConfirm={() => void handleBulkDelete()}
      />
    </>
  )
}
