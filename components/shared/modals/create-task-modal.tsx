'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Package } from 'lucide-react'
import { useCreateTask, useWorkspaceMembers } from '@/hooks/tasks'
import { useAuthStore } from '@/stores/auth'
import type { CreateTaskInput } from '@/types/tasks'

const CATEGORIES = ['Sizing', 'Quality', 'Damaged', 'Wrong Item', 'Late Delivery', 'Other'] as const

const PRIORITIES = [
  { value: 'low', label: 'Low', dot: 'bg-emerald-500' },
  { value: 'medium', label: 'Medium', dot: 'bg-amber-500' },
  { value: 'high', label: 'High', dot: 'bg-rose-500' },
] as const

const LABEL = 'mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground'
const TRIGGER = 'w-full rounded-[10px] border-border bg-card py-[11px] text-[13.5px] data-[size=default]:h-auto'

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']),
  category: z.string().optional(),
  assignedTo: z.string().optional(),
})

type FormValues = z.infer<typeof createTaskSchema>

interface LinkedOrder {
  shopifyOrderId: string
  shopifyOrderName: string
  shopifyCustomerId?: string
  customerName?: string
  customerEmail?: string
}

interface CreateTaskModalProps {
  linkedOrder?: LinkedOrder | null
  onClose: () => void
  onSuccess?: (msg: string, type?: 'success' | 'error') => void
}

export function CreateTaskModal({ linkedOrder, onClose, onSuccess }: CreateTaskModalProps) {
  const isSuspended = useAuthStore((s) => s.isSuspended)
  const createTask = useCreateTask()
  const { data: members } = useWorkspaceMembers()

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: { priority: 'medium', category: '', assignedTo: '' },
  })

  async function onSubmit(values: FormValues) {
    const input: CreateTaskInput = {
      ...values,
      ...(linkedOrder && {
        shopifyOrderId: linkedOrder.shopifyOrderId,
        shopifyOrderName: linkedOrder.shopifyOrderName,
        shopifyCustomerId: linkedOrder.shopifyCustomerId,
        customerName: linkedOrder.customerName,
        customerEmail: linkedOrder.customerEmail,
      }),
    }

    try {
      await createTask.mutateAsync(input)
      onSuccess?.('Task created', 'success')
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create task'
      onSuccess?.(msg, 'error')
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="gap-0 overflow-hidden rounded-[18px] p-0 sm:max-w-[540px]">
        <DialogHeader className="px-6 py-[22px]">
          <DialogTitle className="text-lg font-bold">Create task</DialogTitle>
        </DialogHeader>
        <div className="h-px bg-border" />

        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="flex flex-col gap-[18px] px-6 py-5">
          {/* Title */}
          <div>
            <label className={LABEL}>Title</label>
            <Input
              {...register('title')}
              placeholder="e.g. Investigate sizing complaints on Nike Air Max"
              className="rounded-[10px] border border-border bg-card"
            />
            {errors.title && <p className="mt-1 text-[11px] text-destructive">{errors.title.message}</p>}
          </div>

          {/* Description */}
          <div>
            <label className={LABEL}>Description</label>
            <textarea
              {...register('description')}
              placeholder="Optional details…"
              className="min-h-[92px] w-full resize-y rounded-[10px] border border-border bg-card px-3.5 py-[11px] text-[13.5px] text-foreground outline-none"
            />
          </div>

          {/* Priority + Category */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className={LABEL}>Priority</label>
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v ?? 'medium')}>
                    <SelectTrigger className={TRIGGER}>
                      <SelectValue>
                        {(value: string | null) => {
                          const p = PRIORITIES.find((x) => x.value === value)
                          return (
                            <span className="flex items-center gap-2">
                              <span className={`size-2 rounded-full ${p?.dot ?? 'bg-amber-500'}`} />
                              {p?.label ?? 'Medium'}
                            </span>
                          )
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          <span className={`size-2 rounded-full ${p.dot}`} />
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <label className={LABEL}>Category</label>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <Select value={field.value || ''} onValueChange={(v) => field.onChange(v ?? '')}>
                    <SelectTrigger className={TRIGGER}>
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Assign to */}
          <div>
            <label className={LABEL}>Assign to</label>
            <Controller
              name="assignedTo"
              control={control}
              render={({ field }) => (
                <Select value={field.value || ''} onValueChange={(v) => field.onChange(v ?? '')}>
                  <SelectTrigger className={TRIGGER}>
                    <SelectValue placeholder="Unassigned">
                      {(value: string | null) => members?.find((m) => m.id === value)?.displayName ?? 'Unassigned'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {(members || []).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.displayName} ({m.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Linked order */}
          {linkedOrder && (
            <div>
              <label className={LABEL}>Linked order</label>
              <div className="flex items-center gap-2 rounded-[10px] border border-accent-border bg-accent-soft px-3 py-2.5">
                <Package size={14} className="text-primary" />
                <span className="text-[12px] font-semibold text-primary">{linkedOrder.shopifyOrderName}</span>
                {linkedOrder.customerName && (
                  <>
                    <span className="text-[12px] text-muted-foreground">·</span>
                    <span className="text-[12px] text-foreground-2">{linkedOrder.customerName}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="-mx-6 -mb-5 mt-1 flex justify-end gap-3 border-t border-border bg-[#FAF9FF] px-6 py-4 dark:bg-[rgba(255,255,255,0.03)]">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSuspended || isSubmitting}>
              {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : 'Create task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
