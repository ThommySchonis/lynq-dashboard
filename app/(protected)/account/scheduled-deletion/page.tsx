'use client'

import { useAccountDeletionStatus, useCancelAccountDeletion } from '@/hooks/settings/use-account-deletion'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'

export default function ScheduledDeletionPage() {
  const { data: status, isLoading } = useAccountDeletionStatus()
  const cancelDeletion = useCancelAccountDeletion()
  const clearSession = useAuthStore((s) => s.clearSession)

  if (isLoading) return null

  const deletionDate = status?.scheduledFor
    ? new Date(status.scheduledFor).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="mx-auto max-w-md text-center px-6">
        <h1 className="text-2xl font-semibold text-foreground mb-3">
          Your account is scheduled for deletion
        </h1>
        {deletionDate && (
          <p className="text-foreground-3 mb-2">
            All your data will be permanently deleted on{' '}
            <span className="font-medium text-foreground">{deletionDate}</span>.
          </p>
        )}
        <p className="text-foreground-4 text-sm mb-8">
          If this was a mistake, you can cancel and restore full access.
        </p>
        <Button
          onClick={() =>
            cancelDeletion.mutate(undefined, {
              onSuccess: () => {
                window.location.href = '/'
              },
            })
          }
          disabled={cancelDeletion.isPending}
          className="w-full mb-4"
        >
          {cancelDeletion.isPending ? 'Cancelling...' : 'Cancel deletion'}
        </Button>
        <button
          onClick={() => clearSession()}
          className="text-foreground-4 text-sm underline hover:text-foreground-3"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
