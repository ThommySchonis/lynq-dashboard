import { supabaseAdmin, getUserFromToken } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isPlatformAdmin } from '@/lib/platformAdmin'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  const isAdmin = await isPlatformAdmin(user?.email)
  if (!user || !isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch recent runs and deduplicate to get latest per job
  // With 8 jobs, 50 rows is more than enough to cover all jobs
  const { data, error } = await supabaseAdmin
    .from('cron_job_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const seen = new Set<string>()
  const latest = (data ?? []).filter((row: Record<string, unknown>) => {
    const name = row.job_name as string
    if (seen.has(name)) return false
    seen.add(name)
    return true
  })

  return NextResponse.json({ runs: latest })
}
