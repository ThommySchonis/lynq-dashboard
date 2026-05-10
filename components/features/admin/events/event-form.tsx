'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useCreateMasterclass } from '@/hooks/admin'
import { INITIAL_MASTERCLASS_FORM } from '@/lib/admin-constants'
import type { MasterclassForm } from '@/types/admin'

export function EventForm() {
  const [form, setForm] = useState<MasterclassForm>({ ...INITIAL_MASTERCLASS_FORM })
  const createMutation = useCreateMasterclass()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createMutation.mutateAsync(form)
      setForm({ ...INITIAL_MASTERCLASS_FORM })
      toast.success('Masterclass scheduled!')
    } catch {
      toast.error('Failed to schedule masterclass')
    }
  }

  const update = (field: keyof MasterclassForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <Card>
      <CardContent>
        <div className="mb-0.5 text-[15px] font-semibold text-foreground">
          Schedule masterclass
        </div>
        <div className="mb-5 text-sm text-muted-foreground">
          Appears in the Value Feed of all clients
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              required
              placeholder="How to scale Meta Ads..."
            />
          </div>

          <div>
            <Label>
              Speaker{' '}
              <span className="font-normal normal-case tracking-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              value={form.speaker}
              onChange={(e) => update('speaker', e.target.value)}
              placeholder="Name - Role or company"
            />
          </div>

          <div>
            <Label>
              Description{' '}
              <span className="font-normal normal-case tracking-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="What will attendees learn?"
              className="min-h-[80px]"
            />
          </div>

          <div>
            <Label>Date &amp; time</Label>
            <Input
              type="datetime-local"
              value={form.scheduled_at}
              onChange={(e) => update('scheduled_at', e.target.value)}
              required
            />
          </div>

          <div>
            <Label>
              Zoom link{' '}
              <span className="font-normal normal-case tracking-normal text-muted-foreground">
                (add before session)
              </span>
            </Label>
            <Input
              value={form.zoom_url}
              onChange={(e) => update('zoom_url', e.target.value)}
              placeholder="https://zoom.us/j/..."
            />
          </div>

          <Button type="submit" className="w-full" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Scheduling...' : 'Schedule masterclass'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
