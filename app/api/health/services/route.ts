import { NextResponse } from 'next/server'
import { serviceHealth } from '@/lib/service-health'

export async function GET() {
  return NextResponse.json({ statuses: serviceHealth.getAll() })
}
