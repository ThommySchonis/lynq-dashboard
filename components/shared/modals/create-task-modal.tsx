'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Package } from 'lucide-react'
import { useCreateTask, useWorkspaceMembers } from '@/hooks/tasks'
import type { CreateTaskInput } from '@/types/tasks'

const CATEGORIES = ['Sizing', 'Quality', 'Damaged', 'Wrong Item', 'Late Delivery', 'Other'] as const

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
  const createTask = useCreateTask()
  const { data: members } = useWorkspaceMembers()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: { priority: 'medium' },
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="flex flex-col gap-3.5">
          {/* Title */}
          <div>
            <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">
              Title
            </label>
            <Input
              {...register('title')}
              placeholder="e.g. Investigate sizing complaints on Nike Air Max"
              className="bg-secondary border border-border"
            />
            {errors.title && (
              <p className="text-[11px] text-destructive mt-1">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">
              Description
            </label>
            <textarea
              {...register('description')}
              placeholder="Optional details..."
              className="w-full resize-y rounded-xl border border-border bg-secondary px-3.5 py-[11px] text-[13.5px] text-foreground outline-none min-h-[60px]"
            />
          </div>

          {/* Priority + Category row */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">
                Priority
              </label>
              <select
                {...register('priority')}
                className="w-full rounded-xl border border-border bg-secondary px-3.5 py-[11px] text-[13.5px] text-foreground outline-none cursor-pointer"
              >
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">
                Category
              </label>
              <select
                {...register('category')}
                className="w-full rounded-xl border border-border bg-secondary px-3.5 py-[11px] text-[13.5px] text-foreground outline-none cursor-pointer"
              >
                <option value="">Select...</option>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Assign to */}
          <div>
            <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">
              Assign to
            </label>
            <select
              {...register('assignedTo')}
              className="w-full rounded-xl border border-border bg-secondary px-3.5 py-[11px] text-[13.5px] text-foreground outline-none cursor-pointer"
            >
              <option value="">Unassigned</option>
              {(members || []).map(m => (
                <option key={m.id} value={m.id}>
                  {m.displayName} ({m.role})
                </option>
              ))}
            </select>
          </div>

          {/* Linked order (pre-filled from inbox) */}
          {linkedOrder && (
            <div>
              <label className="text-[10.5px] font-bold tracking-[.07em] uppercase text-muted-foreground mb-[7px] block">
                Linked order
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
                <Package size={14} className="text-primary" />
                <span className="text-[12px] font-semibold text-primary">
                  {linkedOrder.shopifyOrderName}
                </span>
                {linkedOrder.customerName && (
                  <>
                    <span className="text-[12px] text-muted-foreground">·</span>
                    <span className="text-[12px] text-foreground-2">{linkedOrder.customerName}</span>
                  </>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : 'Create task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
