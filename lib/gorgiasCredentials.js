import { supabaseAdmin } from './supabaseAdmin'

export async function getGorgiasCredentials(userId) {
  const { data } = await supabaseAdmin
    .from('integrations')
    .select('gorgias_domain, gorgias_email, gorgias_api_key')
    .eq('client_id', userId)
    .maybeSingle()

  if (!data?.gorgias_api_key) return null

  return {
    domain: data.gorgias_domain,
    email: data.gorgias_email,
    apiKey: data.gorgias_api_key,
    baseUrl: `https://${data.gorgias_domain}.gorgias.com/api`,
    authHeader: 'Basic ' + Buffer.from(`${data.gorgias_email}:${data.gorgias_api_key}`).toString('base64'),
  }
}
