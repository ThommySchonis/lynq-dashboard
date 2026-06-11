// supabase/functions/api/lib/services/migrations/orchestrator.ts

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { MigrationJob, SourceAdapter, SourceCredentials } from './types.ts'

type Phase = 'tags' | 'macros' | 'conversations'

export function advancePhase(current: Phase | null): Phase | null {
  if (current === null) return 'tags'
  if (current === 'tags') return 'macros'
  if (current === 'macros') return 'conversations'
  return null  // conversations → done
}

export function isJobDone(phase: Phase | null): boolean {
  return phase === null
}

// claimNextMigration: atomically pick the oldest ready/running job for this tick.
// Uses FOR UPDATE SKIP LOCKED so overlapping cron invocations don't fight.
export async function claimNextMigration(sb: SupabaseClient): Promise<MigrationJob | null> {
  const { data, error } = await sb.rpc('claim_next_migration')
  if (error) throw error
  if (!data || data.length === 0) return null
  return data[0] as MigrationJob
}

export async function releaseClaim(sb: SupabaseClient, id: string): Promise<void> {
  await sb.from('workspace_migrations').update({ updated_at: new Date().toISOString() }).eq('id', id)
}

export async function markCompleted(sb: SupabaseClient, id: string): Promise<void> {
  await sb.from('workspace_migrations').update({
    status: 'completed',
    phase: null,
    completed_at: new Date().toISOString(),
  }).eq('id', id)
}

export async function markFailed(sb: SupabaseClient, id: string, error: string): Promise<void> {
  await sb.from('workspace_migrations').update({
    status: 'failed',
    error,
  }).eq('id', id)
}

// Loads decrypted credentials from the integrations row referenced by the migration.
export async function loadCreds(sb: SupabaseClient, credentialsRef: string): Promise<SourceCredentials> {
  const { data, error } = await sb.from('integrations').select('*').eq('id', credentialsRef).single()
  if (error || !data) throw new Error(`Credentials not found: ${credentialsRef}`)
  return {
    authMethod: data.migration_auth_method,
    accessToken: data.migration_access_token ?? undefined,
    apiKey: data.migration_api_key ?? undefined,
    username: data.migration_username ?? undefined,
    subdomain: data.migration_subdomain ?? undefined,
  }
}

export async function processOneChunk(
  sb: SupabaseClient,
  job: MigrationJob,
  adapter: SourceAdapter,
  creds: SourceCredentials,
): Promise<{ done: boolean; updatedJob: MigrationJob }> {
  // First tick of a fresh job → enter tags phase
  let phase = job.phase ?? advancePhase(null)
  let cursor = job.cursor
  let progress = job.progress

  if (phase === 'tags') {
    const page = await adapter.fetchTags(creds, cursor.tags ?? null)
    if (page.items.length > 0) {
      const rows = page.items.map((t) => ({
        workspace_id: job.workspace_id,
        source_platform: job.source_platform,
        source_external_id: t.source_external_id,
        name: t.name,
        color: t.color,
      }))
      const { error } = await sb.from('tags').upsert(rows, { onConflict: 'workspace_id,source_platform,source_external_id' })
      if (error) throw error
    }
    cursor = { ...cursor, tags: page.nextCursor ?? undefined }
    progress = { ...progress, tags: { done: (progress.tags?.done ?? 0) + page.items.length, total: progress.tags?.total ?? 0 } }
    if (page.nextCursor === null) phase = advancePhase('tags')
  } else if (phase === 'macros') {
    const page = await adapter.fetchMacros(creds, cursor.macros ?? null)
    if (page.items.length > 0) {
      const rows = page.items.map((m) => ({
        workspace_id: job.workspace_id,
        source_platform: job.source_platform,
        source_external_id: m.source_external_id,
        name: m.name,
        body_html: m.body_html,
        body_text: m.body_text,
      }))
      const { error } = await sb.from('macros').upsert(rows, { onConflict: 'workspace_id,source_platform,source_external_id' })
      if (error) throw error
    }
    cursor = { ...cursor, macros: page.nextCursor ?? undefined }
    progress = { ...progress, macros: { done: (progress.macros?.done ?? 0) + page.items.length, total: progress.macros?.total ?? 0 } }
    if (page.nextCursor === null) phase = advancePhase('macros')
  } else if (phase === 'conversations') {
    const linkedIds = Object.keys(job.mailbox_links)
    const range = {
      start: job.time_range_start ?? new Date(0).toISOString(),
      end: job.time_range_end ?? new Date().toISOString(),
    }
    const page = await adapter.fetchConversations(creds, range, linkedIds, cursor.conversations ?? null)

    const usable = page.items.filter((c) => job.mailbox_links[c.source_mailbox_id])
    if (usable.length > 0) {
      const convRows = usable.map((c) => ({
        workspace_id: job.workspace_id,
        source_platform: job.source_platform,
        source_external_id: c.source_external_id,
        email_account_id: job.mailbox_links[c.source_mailbox_id],
        subject: c.subject,
        customer_email: c.customer_email,
        customer_name: c.customer_name,
        status: c.status,
        from_email: c.customer_email,
        from_name: c.customer_name,
        created_at: c.created_at,
        updated_at: c.updated_at,
      }))
      const upsertResult = await sb
        .from('email_conversations')
        .upsert(convRows, { onConflict: 'workspace_id,source_platform,source_external_id' })
        .select('id, source_external_id')
      const insertedConvs = (upsertResult as { data: unknown; error: { message: string } | null }).data
      const convErr = (upsertResult as { data: unknown; error: { message: string } | null }).error
      if (convErr) throw convErr

      const convIdByExt = new Map<string, string>()
      for (const row of (insertedConvs ?? []) as Array<{ id: string; source_external_id: string }>) {
        convIdByExt.set(row.source_external_id, row.id)
      }

      const msgRows: Record<string, unknown>[] = []
      for (const c of usable) {
        const convId = convIdByExt.get(c.source_external_id)
        if (!convId) continue
        for (const m of c.messages) {
          msgRows.push({
            workspace_id: job.workspace_id,
            conversation_id: convId,
            source_platform: job.source_platform,
            source_external_id: m.source_external_id,
            direction: m.direction,
            from_email: m.from_email,
            from_name: m.from_name,
            body_html: m.body_html,
            body_text: m.body_text,
            created_at: m.created_at,
          })
        }
      }
      if (msgRows.length > 0) {
        const { error: msgErr } = await sb
          .from('email_messages')
          .upsert(msgRows, { onConflict: 'workspace_id,source_platform,source_external_id' })
        if (msgErr) throw msgErr
      }

      // Map source tag external_ids → Lynq tag.id, write join rows
      const allExtTagIds = Array.from(new Set(usable.flatMap((c) => c.tag_external_ids)))
      if (allExtTagIds.length > 0) {
        const { data: tagRows } = await sb
          .from('tags')
          .select('id, source_external_id')
          .eq('workspace_id', job.workspace_id)
          .eq('source_platform', job.source_platform)
          .in('source_external_id', allExtTagIds)
        const tagIdByExt = new Map<string, string>()
        for (const t of (tagRows ?? []) as Array<{ id: string; source_external_id: string }>) {
          tagIdByExt.set(t.source_external_id, t.id)
        }
        const tagAssign: Record<string, unknown>[] = []
        for (const c of usable) {
          const convId = convIdByExt.get(c.source_external_id)
          if (!convId) continue
          for (const extTagId of c.tag_external_ids) {
            const tagId = tagIdByExt.get(extTagId)
            if (!tagId) continue
            tagAssign.push({ conversation_id: convId, tag_id: tagId, workspace_id: job.workspace_id })
          }
        }
        if (tagAssign.length > 0) {
          await sb.from('email_conversation_tags').upsert(tagAssign, { onConflict: 'conversation_id,tag_id' })
        }
      }
    }

    cursor = { ...cursor, conversations: page.nextCursor ?? undefined }
    progress = { ...progress, conversations: { done: (progress.conversations?.done ?? 0) + usable.length, total: progress.conversations?.total ?? 0 } }
    if (page.nextCursor === null) phase = advancePhase('conversations')
  } else {
    return { done: true, updatedJob: job }
  }

  // Persist job state
  const update = {
    phase,
    cursor,
    progress,
    updated_at: new Date().toISOString(),
  }
  await sb.from('workspace_migrations').update(update).eq('id', job.id)

  return {
    done: phase === null,
    updatedJob: { ...job, phase, cursor, progress },
  }
}
