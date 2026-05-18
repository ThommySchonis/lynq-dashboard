'use client'

import { toast } from 'sonner'
import { useBroadcasts, useBroadcastReactions, useDeleteBroadcast, useTogglePin } from '@/hooks/admin'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { BroadcastRow } from './broadcast-row'

export function BroadcastList() {
  const { data: broadcasts = [] } = useBroadcasts()
  const { data: reactions = [] } = useBroadcastReactions()
  const deleteMutation = useDeleteBroadcast()
  const togglePinMutation = useTogglePin()

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id)
      toast.success('Broadcast deleted')
    } catch {
      toast.error('Failed to delete broadcast')
    }
  }

  const handleTogglePin = async (id: string, isPinned: boolean) => {
    try {
      await togglePinMutation.mutateAsync({ id, isPinned })
      toast.success(isPinned ? 'Unpinned' : 'Pinned')
    } catch {
      toast.error('Failed to update pin')
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Published — {broadcasts.length}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {broadcasts.length === 0 ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">
            No posts yet.
          </div>
        ) : (
          broadcasts.map((b) => (
            <BroadcastRow
              key={b.id}
              broadcast={b}
              reactions={reactions}
              onDelete={() => void handleDelete(b.id)}
              onTogglePin={() => void handleTogglePin(b.id, b.is_pinned)}
            />
          ))
        )}
      </CardContent>
    </Card>
  )
}
