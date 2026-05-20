import { getAuthContext } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { getTasks, createTask } from '@/lib/services/tasks'
import { validateQuery, validateBody } from '@/lib/validation'
import { getTasksQuery, createTaskBody } from '@/lib/schemas/tasks'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Role } from '@/types/database'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.viewTasks(ctx.role as Role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [query, qErr] = validateQuery(request, getTasksQuery)
  if (qErr) return qErr

  try {
    const tasks = await getTasks(ctx.workspaceId, query)
    return NextResponse.json({ tasks })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch tasks'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.manageTasks(ctx.role as Role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [body, bErr] = await validateBody(request, createTaskBody)
  if (bErr) return bErr

  try {
    const task = await createTask(ctx.workspaceId, ctx.memberId, body)
    return NextResponse.json({ task }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create task'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
