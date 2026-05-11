'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2, Check, X, Pencil } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useMasterclasses, useDeleteMasterclass, useUpdateZoomUrl } from '@/hooks/admin'
import { useAdminUI } from '@/stores/admin-ui'
import { fmtDT, isPast } from '@/lib/admin-utils'

export function EventList() {
  const { data: masterclasses = [] } = useMasterclasses()
  const deleteMutation = useDeleteMasterclass()
  const updateZoomMutation = useUpdateZoomUrl()
  const editingZoomId = useAdminUI((s) => s.editingZoomId)
  const setEditingZoomId = useAdminUI((s) => s.setEditingZoomId)
  const [editingUrl, setEditingUrl] = useState('')

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('Delete this masterclass? This cannot be undone.')
    if (!confirmed) return
    try {
      await deleteMutation.mutateAsync(id)
      toast.success('Masterclass deleted')
    } catch {
      toast.error('Failed to delete masterclass')
    }
  }

  const startEditing = (id: string, currentUrl: string) => {
    setEditingZoomId(id)
    setEditingUrl(currentUrl)
  }

  const saveZoom = async (id: string) => {
    try {
      await updateZoomMutation.mutateAsync({ id, url: editingUrl })
      setEditingZoomId(null)
      toast.success('Zoom URL updated')
    } catch {
      toast.error('Failed to update Zoom URL')
    }
  }

  const cancelEditing = () => {
    setEditingZoomId(null)
    setEditingUrl('')
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Masterclasses &mdash; {masterclasses.length}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {masterclasses.length === 0 ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">
            No masterclasses scheduled yet.
          </div>
        ) : (
          masterclasses.map((mc) => {
            const past = isPast(mc.scheduled_at)
            const isEditing = editingZoomId === mc.id
            const date = new Date(mc.scheduled_at)

            return (
              <div
                key={mc.id}
                className="flex items-start gap-3.5 border-b border-border/25 px-4 py-3.5 last:border-b-0"
              >
                {/* Date badge */}
                <div
                  className={`w-10 shrink-0 rounded-[9px] border py-[7px] text-center ${
                    past
                      ? 'border-border/40 bg-muted'
                      : 'border-violet-500/20 bg-violet-500/8'
                  }`}
                >
                  <div
                    className={`text-lg font-extrabold leading-none ${
                      past ? 'text-muted-foreground' : 'text-violet-600'
                    }`}
                  >
                    {date.getDate()}
                  </div>
                  <div
                    className={`mt-0.5 text-[9px] font-bold uppercase tracking-wide ${
                      past ? 'text-muted-foreground' : 'text-violet-600/70'
                    }`}
                  >
                    {date.toLocaleDateString('en-US', { month: 'short' })}
                  </div>
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <span
                      className={`text-[11px] font-semibold uppercase tracking-wide ${
                        past ? 'text-muted-foreground' : 'text-violet-600'
                      }`}
                    >
                      {past ? 'Past' : 'Upcoming'}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {fmtDT(mc.scheduled_at)}
                    </span>
                  </div>
                  <div
                    className={`text-[13.5px] font-semibold leading-snug ${
                      past ? 'text-muted-foreground' : 'text-foreground'
                    }`}
                  >
                    {mc.title}
                  </div>
                  {mc.speaker && (
                    <div className="text-[11.5px] text-muted-foreground">with {mc.speaker}</div>
                  )}

                  {/* Zoom URL editing */}
                  {isEditing ? (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Input
                        value={editingUrl}
                        onChange={(e) => setEditingUrl(e.target.value)}
                        placeholder="https://zoom.us/j/..."
                        className="h-7 flex-1 text-[11.5px]"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveZoom(mc.id)
                          if (e.key === 'Escape') cancelEditing()
                        }}
                      />
                      <Button
                        size="sm"
                        className="h-7 px-2.5 text-[11px]"
                        onClick={() => saveZoom(mc.id)}
                      >
                        <Check size={12} className="mr-1" />
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-[11px]"
                        onClick={cancelEditing}
                      >
                        <X size={12} />
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-1 flex items-center gap-1.5">
                      {mc.zoom_url ? (
                        <span className="text-[11px] text-emerald-600">Zoom link set</span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">No Zoom link yet</span>
                      )}
                      <button
                        onClick={() => startEditing(mc.id, mc.zoom_url || '')}
                        className="text-[10px] text-muted-foreground transition-colors hover:text-violet-600"
                      >
                        <Pencil size={10} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Delete button */}
                <button
                  onClick={() => handleDelete(mc.id)}
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-red-500"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
