import { getUserFromToken } from '../../../../lib/supabaseAdmin'
import { getGorgiasCredentials } from '../../../../lib/gorgiasCredentials'
import { NextResponse } from 'next/server'

function startOfWeek(d) {
  const r = new Date(d)
  const day = r.getDay()
  r.setDate(r.getDate() - day + (day === 0 ? -6 : 1))
  r.setHours(0, 0, 0, 0)
  return r
}

function weekLabel(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const creds = await getGorgiasCredentials(user.id)
  if (!creds) return NextResponse.json({ error: 'Gorgias not connected' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')
  if (!from || !to) return NextResponse.json({ error: 'Missing from/to' }, { status: 400 })

  const fromISO = `${from}T00:00:00`
  const toISO   = `${to}T23:59:59`

  try {
    const allTickets = []
    let cursor = null

    while (true) {
      const fromEnc = encodeURIComponent(`created_datetime:>:${fromISO}`)
      const toEnc   = encodeURIComponent(`created_datetime:<:${toISO}`)
      let url = `${creds.baseUrl}/tickets?order_by=created_datetime:desc&limit=100&filter[]=${fromEnc}&filter[]=${toEnc}`
      if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`

      const res = await fetch(url, {
        headers: { Authorization: creds.authHeader, 'Content-Type': 'application/json' },
      })

      if (res.status === 429) {
        const wait = parseInt(res.headers.get('Retry-After') || '2') * 1000
        await new Promise(r => setTimeout(r, wait))
        continue
      }
      if (!res.ok) break

      const data = await res.json()
      allTickets.push(...(data.data || []))

      cursor = data.meta?.next_cursor
      if (!cursor || allTickets.length >= 1000) break
    }

    // Workload
    const created          = allTickets.length
    const closed           = allTickets.filter(t => t.status === 'closed').length
    const open             = allTickets.filter(t => t.status === 'open').length
    const messagesReceived = allTickets.reduce((s, t) => s + (t.messages_count || 0), 0)

    // Response times
    const firstResponseMins = []
    const resolutionMins    = []

    allTickets.forEach(t => {
      if (t.first_response_datetime && t.created_datetime) {
        const diff = (new Date(t.first_response_datetime) - new Date(t.created_datetime)) / 60000
        if (diff > 0 && diff < 7 * 24 * 60) firstResponseMins.push(diff)
      }
      if (t.status === 'closed' && t.created_datetime) {
        const closeTs = t.closed_datetime || t.updated_datetime
        if (closeTs) {
          const diff = (new Date(closeTs) - new Date(t.created_datetime)) / 60000
          if (diff > 0 && diff < 30 * 24 * 60) resolutionMins.push(diff)
        }
      }
    })

    const avgFirstResponse = firstResponseMins.length > 0
      ? Math.round(firstResponseMins.reduce((s, v) => s + v, 0) / firstResponseMins.length)
      : null
    const avgResolution = resolutionMins.length > 0
      ? Math.round(resolutionMins.reduce((s, v) => s + v, 0) / resolutionMins.length)
      : null

    // Productivity
    const ticketsReplied = allTickets.filter(t => (t.messages_count || 0) >= 2).length
    const messagesSent   = allTickets.reduce((s, t) => s + Math.max(0, Math.floor((t.messages_count || 1) / 2)), 0)
    const oneTouchCount  = allTickets.filter(t => t.status === 'closed' && (t.messages_count || 0) <= 2).length
    const oneTouchPct    = closed > 0 ? ((oneTouchCount / closed) * 100).toFixed(1) : '0.0'
    const avgMessages    = created > 0 ? (messagesReceived / created).toFixed(1) : '0.0'

    // Channel breakdown
    const channelMap = {}
    allTickets.forEach(t => {
      const ch = (t.channel || 'other').replace(/-/g, ' ')
      channelMap[ch] = (channelMap[ch] || 0) + 1
    })
    const channels = Object.entries(channelMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        count,
        pct: created > 0 ? Math.round((count / created) * 100) : 0,
      }))

    // Weekly chart — pre-populate all weeks in range
    const weeklyMap = new Map()
    const startDate = startOfWeek(new Date(`${from}T00:00:00`))
    const endDate   = new Date(`${to}T23:59:59`)
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 7)) {
      const label = weekLabel(d)
      weeklyMap.set(label, { label, created: 0, closed: 0 })
    }

    allTickets.forEach(t => {
      if (!t.created_datetime) return
      const label = weekLabel(startOfWeek(new Date(t.created_datetime)))
      if (!weeklyMap.has(label)) weeklyMap.set(label, { label, created: 0, closed: 0 })
      const w = weeklyMap.get(label)
      w.created++
      if (t.status === 'closed') w.closed++
    })

    const weekly = Array.from(weeklyMap.values()).slice(-8)

    return NextResponse.json({
      workload:      { created, closed, open, messagesReceived, weekly },
      responseTimes: {
        avgFirstResponse,
        avgResolution,
        firstResponseSample: firstResponseMins.length,
        resolutionSample:    resolutionMins.length,
      },
      productivity:  { ticketsReplied, messagesSent, oneTouchCount, oneTouchPct, avgMessages, channels },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
