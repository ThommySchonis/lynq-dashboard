import { getAuthContext } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { updateTask, deleteTask } from '@/lib/services/tasks'
import { validateBody, validateParams } from '@/lib/validation'
import { taskParams, updateTaskBody } from '@/lib/schemas/tasks'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Role } from '@/types/database'
import type { RouteContext } from '@/types/api'

export async function PATCH(request: NextRequest, { params }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.manageTasks(ctx.role as Role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [p, pErr] = validateParams(await params, taskParams)
  if (pErr) return pErr

  const [body, bErr] = await validateBody(request, updateTaskBody)
  if (bErr) return bErr

  try {
    const task = await updateTask(ctx.workspaceId, p.id, body)
    return NextResponse.json({ task })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update task'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.deleteTasks(ctx.role as Role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [p, pErr] = validateParams(await params, taskParams)
  if (pErr) return pErr

  try {
    await deleteTask(ctx.workspaceId, p.id)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete task'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
