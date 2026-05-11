'use client'

import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { useTeamMembers, useDeleteTeamMember } from '@/hooks/admin'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export function TeamList() {
  const { data: teamMembers = [] } = useTeamMembers()
  const deleteMutation = useDeleteTeamMember()

  const handleDelete = async (id: string, email: string) => {
    const confirmed = window.confirm(`Remove ${email} from the team? This cannot be undone.`)
    if (!confirmed) return

    try {
      await deleteMutation.mutateAsync(id)
      toast.success(`${email} removed from team`)
    } catch {
      toast.error('Failed to remove team member')
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Team — {teamMembers.length}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {teamMembers.length === 0 ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">
            No team members yet.
          </div>
        ) : (
          teamMembers.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-border/40 last:border-b-0"
            >
              <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                {(m.name || '?')[0].toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-foreground">
                  {m.name}
                </div>
                <div className="text-xs text-muted-foreground">{m.email}</div>
                <div className="text-[11px] text-muted-foreground/70 mt-px">
                  {new Date(m.created_at).toLocaleDateString('en-US')}
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-violet-500/8 text-violet-600 border border-violet-500/15">
                  {m.role}
                </span>
                <button
                  onClick={() => handleDelete(m.id, m.email)}
                  className="text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
