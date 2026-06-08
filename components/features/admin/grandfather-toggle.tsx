'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { apiUrl } from '@/lib/api-client'
import { adminKeys } from '@/hooks/admin/use-admin-data'

const schema = z.object({
  enabled: z.boolean(),
  reason: z.string(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  workspaceId: string
  initialEnabled: boolean
  initialReason: string | null
}

interface ErrorResponse {
  error?: string
}

interface OkResponse {
  ok: boolean
}

export function GrandfatherToggle({ workspaceId, initialEnabled, initialReason }: Props) {
  const token = useAuthStore((s) => s.session?.access_token ?? '')
  const qc = useQueryClient()

  const { register, watch, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      enabled: initialEnabled,
      reason: initialReason ?? '',
    },
  })

  const enabled = watch('enabled')

  const m = useMutation({
    mutationFn: async (values: FormValues) => {
      const body = {
        enabled: values.enabled,
        reason: values.enabled ? (values.reason.trim() || null) : null,
      }
      const res = await fetch(apiUrl(`lynq-admin/billing/grandfather/${workspaceId}`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as ErrorResponse
        throw new Error(err.error ?? 'Failed to update')
      }
      return res.json() as Promise<OkResponse>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.clientOverview() }),
  })

  return (
    <form
      onSubmit={(e) => void handleSubmit((values) => m.mutate(values))(e)}
      className="rounded border border-border bg-card p-3 text-sm"
    >
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          {...register('enabled')}
          className="rounded border-border accent-primary"
        />
        <span className="font-medium text-foreground">Grandfather this workspace</span>
      </label>
      <p className="mt-1 text-xs text-muted-foreground">
        Bypasses Shopify subscription requirement.
      </p>
      {enabled && (
        <input
          type="text"
          placeholder="Reason (optional)"
          {...register('reason')}
          className="mt-2 w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      )}
      <button
        type="submit"
        disabled={m.isPending}
        className="mt-2 rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {m.isPending ? 'Saving…' : 'Save'}
      </button>
      {m.isError && (
        <p className="mt-2 text-xs text-destructive">
          {m.error instanceof Error ? m.error.message : 'Save failed'}
        </p>
      )}
      {m.isSuccess && (
        <p className="mt-2 text-xs text-success">Saved.</p>
      )}
    </form>
  )
}
