'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useCreateNotification } from '@/hooks/admin'
import { INITIAL_NOTIFICATION_FORM, NOTIFICATION_TYPES } from '@/lib/admin-constants'
import type { NotificationForm as NotificationFormType, NotificationType } from '@/types/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export function NotificationForm() {
  const [form, setForm] = useState<NotificationFormType>(INITIAL_NOTIFICATION_FORM)
  const mutation = useCreateNotification()

  const canSubmit = form.title.trim() && form.body.trim()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await mutation.mutateAsync(form)
      toast.success('Notification pushed successfully')
      setForm(INITIAL_NOTIFICATION_FORM)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to push notification')
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-[15px] font-semibold text-foreground mb-0.5">
          Push notification
        </div>
        <div className="text-[13px] text-muted-foreground mb-5">
          Appears in the notification icon of all clients
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <Label className="mb-1.5">Type</Label>
          <div className="flex gap-2 mb-3.5">
            {NOTIFICATION_TYPES.map(({ type, label }) => {
              const isSelected = form.type === type
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, type: type as NotificationType }))}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                    isSelected
                      ? 'border-violet-500/40 bg-violet-500/6 text-violet-600'
                      : 'border-border/60 bg-transparent text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <Label className="mb-1.5">Title</Label>
          <Input
            className="mb-3"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            required
            placeholder="Notification subject"
          />

          <Label className="mb-1.5">Message</Label>
          <Textarea
            className="mb-3 min-h-[100px]"
            value={form.body}
            onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
            required
            placeholder="Write your notification here..."
          />

          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending || !canSubmit}
          >
            {mutation.isPending ? 'Pushing...' : 'Push notification'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
