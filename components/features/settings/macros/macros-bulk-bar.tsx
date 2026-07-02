'use client'

import { useState } from 'react'
import { Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSettingsUI } from '@/stores/settings-ui'
import { useDeleteMacro } from '@/hooks/settings/use-macro-mutations'
import { ConfirmDialog } from '@/components/features/settings/confirm-dialog'

interface MacrosBulkBarProps {
  canDelete: boolean
}

export function MacrosBulkBar({ canDelete }: MacrosBulkBarProps) {
  const selectedMacroIds = useSettingsUI((s) => s.selectedMacroIds)
  const clearMacroSelection = useSettingsUI((s) => s.clearMacroSelection)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const deleteMacro = useDeleteMacro()

  const count = selectedMacroIds.size
  if (count === 0) return null

  async function handleBulkDelete() {
    const ids = Array.from(selectedMacroIds)
    for (const id of ids) {
      deleteMacro.mutate(id)
    }
    setShowDeleteConfirm(false)
    clearMacroSelection()
  }

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2 text-sm">
        <span>
          <strong>{count}</strong> selected
        </span>
        <div className="ml-auto flex items-center gap-2">
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
            onClick={clearMacroSelection}
            aria-label="Clear selection"
          >
            <X size={14} strokeWidth={1.75} />
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={`Delete ${count} macro${count === 1 ? '' : 's'}?`}
        description={`This permanently removes ${count} macro${count === 1 ? '' : 's'} from your workspace. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMacro.isPending}
        onConfirm={() => void handleBulkDelete()}
      />
    </>
  )
}
