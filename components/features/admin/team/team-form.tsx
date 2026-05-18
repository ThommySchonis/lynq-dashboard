'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useCreateTeamMember } from '@/hooks/admin'
import { INITIAL_TEAM_FORM } from '@/lib/admin-constants'
import type { TeamMemberForm as TeamMemberFormType } from '@/types/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const ROLES = ['admin', 'agent', 'observer'] as const

export function TeamForm() {
  const [form, setForm] = useState<TeamMemberFormType>(INITIAL_TEAM_FORM)
  const mutation = useCreateTeamMember()

  const canSubmit = form.name.trim() && form.email.trim() && form.password.length >= 6

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await mutation.mutateAsync(form)
      toast.success(`${form.name} can now log in with ${form.email}`)
      setForm(INITIAL_TEAM_FORM)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create team member')
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-[15px] font-semibold text-foreground mb-0.5">
          Add team member
        </div>
        <div className="text-[13px] text-muted-foreground mb-5">
          Account created instantly — no email confirmation required
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <Label className="mb-1.5">Name</Label>
          <Input
            className="mb-3"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            required
            placeholder="Jan de Vries"
          />

          <Label className="mb-1.5">Email</Label>
          <Input
            className="mb-3"
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            required
            placeholder="jan@lynqagency.com"
          />

          <Label className="mb-1.5">Password</Label>
          <Input
            className="mb-3"
            type="password"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            required
            placeholder="Min. 6 characters"
          />

          <Label className="mb-1.5">Role</Label>
          <div className="flex gap-2 mb-5">
            {ROLES.map((r) => {
              const isSelected = form.role === r
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, role: r }))}
                  className={`px-4 py-1.5 rounded-lg border text-[12.5px] font-semibold transition-colors ${
                    isSelected
                      ? 'border-violet-500/40 bg-violet-500/6 text-violet-600'
                      : 'border-border/60 bg-transparent text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              )
            })}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending || !canSubmit}
          >
            {mutation.isPending ? 'Creating...' : 'Create account'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
