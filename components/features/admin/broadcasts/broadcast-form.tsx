'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useCreateBroadcast } from '@/hooks/admin'
import { INITIAL_BROADCAST_FORM, BROADCAST_TYPES, BROADCAST_TOPICS } from '@/lib/admin-constants'
import { getYoutubeId } from '@/lib/admin-utils'
import type { BroadcastForm as BroadcastFormType, BroadcastType } from '@/types/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export function BroadcastForm() {
  const [form, setForm] = useState<BroadcastFormType>(INITIAL_BROADCAST_FORM)
  const mutation = useCreateBroadcast()

  const cfg = BROADCAST_TYPES[form.type]
  const ytId = form.type === 'video' ? getYoutubeId(form.youtube_url) : null
  const canSubmit = form.title.trim() && (form.type === 'video' || form.body.trim())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await mutation.mutateAsync(form)
      toast.success(`${cfg.label} published successfully`)
      setForm(INITIAL_BROADCAST_FORM)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish')
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-[15px] font-semibold text-foreground mb-0.5">
          New post
        </div>
        <div className="text-[13px] text-muted-foreground mb-5">
          Published to the Value Feed of all clients
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <Label className="mb-1.5">Content type</Label>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {(Object.entries(BROADCAST_TYPES) as [BroadcastType, typeof cfg][]).map(
              ([id, type]) => {
                const isSelected = form.type === id
                const TypeIcon = type.icon
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, type: id }))}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      isSelected
                        ? `${type.bgClass} ${type.borderClass}`
                        : 'border-border/60 bg-transparent hover:bg-muted/50'
                    }`}
                  >
                    <span className={isSelected ? type.colorClass : 'text-muted-foreground'}>
                      <TypeIcon size={14} strokeWidth={1.75} />
                    </span>
                    <div>
                      <div
                        className={`text-[12.5px] font-semibold ${
                          isSelected ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {type.label}
                      </div>
                      <div className="text-[10.5px] text-muted-foreground mt-px">
                        {type.desc}
                      </div>
                    </div>
                  </button>
                )
              }
            )}
          </div>

          <div className="mb-1.5">
            <Label>
              Topic{' '}
              <span className="font-normal normal-case tracking-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
          </div>
          <div className="flex gap-1.5 flex-wrap mb-4">
            {BROADCAST_TOPICS.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    topic: prev.topic === topic ? '' : topic,
                  }))
                }
                className={`text-[11.5px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                  form.topic === topic
                    ? 'border-foreground/20 bg-foreground/5 text-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted/50'
                }`}
              >
                {topic}
              </button>
            ))}
          </div>

          {form.type === 'video' && (
            <div className="mb-3.5">
              <Label className="mb-1.5">YouTube URL</Label>
              <Input
                value={form.youtube_url}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, youtube_url: e.target.value }))
                }
                placeholder="https://youtube.com/watch?v=..."
                className={ytId ? 'mb-2' : 'mb-3.5'}
              />
              {ytId && (
                <div className="rounded-lg overflow-hidden relative pt-[36%] mb-3.5">
                  <img
                    src={`https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`}
                    alt="Video thumbnail"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          )}

          <Label className="mb-1.5">Title</Label>
          <Input
            className="mb-3 text-sm font-semibold"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            required
            placeholder={form.type === 'tip' ? 'Your tip in one sentence...' : 'Post title...'}
          />

          <Label className="mb-1.5">
            {form.type === 'video' ? 'Description' : 'Content'}
          </Label>
          <Textarea
            className="mb-3 min-h-[100px]"
            value={form.body}
            onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
            required={form.type !== 'video'}
            placeholder="Write your content here..."
          />

          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending || !canSubmit}
          >
            {mutation.isPending ? 'Publishing...' : `Publish ${cfg.label}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
