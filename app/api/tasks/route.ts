import { getAuthContext } from '../../../lib/auth'
import { can } from '../../../lib/permissions'
import { getTasks, createTask } from '../../../lib/services/tasks'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Role } from '@/types/database'
import type { TaskFilters } from '@/types/tasks'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.viewTasks(ctx.role as Role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const filters: TaskFilters = {}
  const status = searchParams.get('status')
  if (status === 'open' || status === 'picked_up' || status === 'done') filters.status = status
  const priority = searchParams.get('priority')
  if (priority === 'high' || priority === 'medium' || priority === 'low') filters.priority = priority
  const assignee = searchParams.get('assignee')
  if (assignee) filters.assignee = assignee
  const limit = searchParams.get('limit')
  if (limit) filters.limit = parseInt(limit, 10)
  const offset = searchParams.get('offset')
  if (offset) filters.offset = parseInt(offset, 10)

  try {
    const tasks = await getTasks(ctx.workspaceId, filters)
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

  const body = (await request.json() as unknown) as Parameters<typeof createTask>[2]
  if (!body.title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  try {
    const task = await createTask(ctx.workspaceId, ctx.memberId, body)
    return NextResponse.json({ task }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create task'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
