'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTags } from '@/hooks/settings'
import { useDeleteTag } from '@/hooks/settings'
import { ConfirmDialog } from '@/components/features/settings/confirm-dialog'
import { TagsTable } from './tags-table'
import { TagsBulkBar } from './tags-bulk-bar'
import { TagEditModal } from './tag-edit-modal'
import type { Tag } from '@/types/settings'

export function TagsView() {
  const { data: tags = [], isLoading } = useTags()
  const deleteTag = useDeleteTag()

  // Modal state
  const [editTag, setEditTag] = useState<Tag | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null)

  // TODO: get role from auth context; for now assume manage+delete permissions
  const canManage = true
  const canDelete = true

  function handleCreate() {
    setEditTag(null)
    setEditOpen(true)
  }

  function handleEdit(tag: Tag) {
    setEditTag(tag)
    setEditOpen(true)
  }

  function handleDelete(tag: Tag) {
    setDeleteTarget(tag)
  }

  function confirmDelete() {
    if (!deleteTarget) return
    deleteTag.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    })
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 px-10 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Manage tags</h1>
          <p className="text-sm text-muted-foreground">
            Tags help organize macros, tickets, and conversations.
          </p>
        </div>
        {canManage && (
          <Button onClick={handleCreate}>
            <Plus size={16} strokeWidth={1.75} />
            Create tag
          </Button>
        )}
      </div>

      <TagsBulkBar tags={tags} canDelete={canDelete} />

      <TagsTable
        tags={tags}
        isLoading={isLoading}
        canManage={canManage}
        canDelete={canDelete}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onCreate={handleCreate}
      />

      <TagEditModal
        open={editOpen}
        onOpenChange={setEditOpen}
        tag={editTag}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={`Delete tag "${deleteTarget?.name}"?`}
        description={`This will remove "${deleteTarget?.name}" from ${deleteTarget?.usage_count ?? 0} item${deleteTarget?.usage_count === 1 ? '' : 's'}. This cannot be undone.`}
        confirmLabel="Delete tag"
        variant="danger"
        loading={deleteTag.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
