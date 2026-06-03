import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { getAdminClient } from '../lib/supabase.ts'
import type { AuthContext } from '../lib/types.ts'

const app = new Hono()

app.use('*', authMiddleware)

// ── List visible candidates ─────────────────────────────────────────

app.get('/candidates', async (c) => {
  const sb = getAdminClient()
  const role = c.req.query('role')
  const availability = c.req.query('availability')

  let q = sb
    .from('talent_profiles')
    .select('id, display_code, role, exam_score, experience_years, previous_industries, skills, languages, hourly_rate, availability, tools_experience, about, verified_at')
    .eq('visible', true)
    .order('exam_score', { ascending: false })

  if (role) q = q.eq('role', role)
  if (availability) q = q.eq('availability', availability)

  const { data, error } = await q
  if (error) return c.json({ error: 'Failed to load candidates' }, 500)

  return c.json({ candidates: data || [] })
})

// ── Single candidate ────────────────────────────────────────────────

app.get('/candidates/:id', async (c) => {
  const sb = getAdminClient()
  const id = c.req.param('id')

  const { data, error } = await sb
    .from('talent_profiles')
    .select('id, display_code, role, exam_score, experience_years, previous_industries, skills, languages, hourly_rate, availability, tools_experience, about, verified_at')
    .eq('id', id)
    .eq('visible', true)
    .single()

  if (error || !data) return c.json({ error: 'Candidate not found' }, 404)

  return c.json({ candidate: data })
})

// ── Own profile ─────────────────────────────────────────────────────

app.get('/profile', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()

  const { data } = await sb
    .from('talent_profiles')
    .select('*')
    .eq('user_id', ctx.user.id)
    .maybeSingle()

  return c.json({ profile: data || null })
})

app.post('/profile', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()
  const body = await c.req.json()

  const { data: examProfile } = await sb
    .from('profiles')
    .select('exam_status, exam_type_taken, exam_score')
    .eq('id', ctx.user.id)
    .single()

  const ep = examProfile as { exam_status?: string; exam_type_taken?: string; exam_score?: number } | null
  if (!ep?.exam_status || ep.exam_status === 'not_started') {
    return c.json({ error: 'You must pass an exam before creating a profile.' }, 403)
  }

  const { data, error } = await sb
    .from('talent_profiles')
    .upsert({
      user_id: ctx.user.id,
      role: ep.exam_type_taken,
      exam_score: ep.exam_score,
      exam_type: ep.exam_type_taken,
      photo_url: body.photo_url,
      experience_years: body.experience_years,
      previous_industries: body.previous_industries,
      skills: body.skills,
      languages: body.languages,
      hourly_rate: body.hourly_rate,
      availability: body.availability,
      tools_experience: body.tools_experience,
      about: body.about,
      visible: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select('id')
    .single()

  if (error) return c.json({ error: 'Failed to save profile' }, 500)

  return c.json({ success: true, profile_id: (data as { id: string }).id })
})

// ── Purchase candidate ──────────────────────────────────────────────

const PLACEMENT_FEE = 299
const TRAINER_FEE = 199

app.post('/purchase', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const sb = getAdminClient()
  const body = await c.req.json()

  const { talent_profile_id, include_trainer, company_name, contact_name, contact_phone, notes } = body

  const { data: candidate } = await sb
    .from('talent_profiles')
    .select('id, display_code, role, hourly_rate')
    .eq('id', talent_profile_id)
    .eq('visible', true)
    .single()

  if (!candidate) return c.json({ error: 'Candidate not found or no longer available' }, 404)

  const { data: existing } = await sb
    .from('talent_purchases')
    .select('id')
    .eq('client_user_id', ctx.user.id)
    .eq('talent_profile_id', talent_profile_id)
    .in('payment_status', ['pending', 'paid'])
    .maybeSingle()

  if (existing) return c.json({ error: 'You have already requested this candidate.' }, 409)

  const totalAmount = PLACEMENT_FEE + (include_trainer ? TRAINER_FEE : 0)

  const { data: purchase, error } = await sb
    .from('talent_purchases')
    .insert({
      client_user_id: ctx.user.id,
      talent_profile_id,
      include_trainer: !!include_trainer,
      placement_fee: PLACEMENT_FEE,
      trainer_fee: include_trainer ? TRAINER_FEE : 0,
      total_amount: totalAmount,
      payment_status: 'pending',
      status: 'pending',
      notes: JSON.stringify({ company_name, contact_name, contact_phone, notes }),
    })
    .select('id')
    .single()

  if (error) return c.json({ error: 'Failed to create purchase request' }, 500)

  return c.json({
    success: true,
    purchase_id: (purchase as { id: string }).id,
    total_amount: totalAmount,
    placement_fee: PLACEMENT_FEE,
    trainer_fee: include_trainer ? TRAINER_FEE : 0,
    message: `Your request for ${(candidate as { display_code: string }).display_code} has been received.`,
  })
})

export { app as marketplaceRoutes }
