import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseKey)

Deno.serve(async (req) => {
  // Accept both POST (cron trigger) and GET (manual invoke)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const { error, count } = await supabase
    .from('webhook_events')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff)
    .neq('status', 'processing')

  if (error) {
    console.error('[webhook-cleanup] delete failed:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  console.log(`[webhook-cleanup] purged ${count ?? 0} events older than 90 days`)
  return new Response(JSON.stringify({ purged: count ?? 0 }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
