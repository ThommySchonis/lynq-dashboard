import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { cancelSubscription } from '@/lib/services/billing'
import { getPendingTransfer } from '@/lib/services/ownership-transfer'
import { sendDeletionScheduledEmail, sendDeletionCompletedEmail } from '@/lib/emails/account-deletion'
import { logger } from '@/lib/logger'

export async function getAccountDeletionStatus(userId: string): Promise<{
  scheduled: boolean
  scheduledFor: string | null
}> {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('scheduled_for_deletion_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    logger.error('[account-deletion]', 'getStatus failed', { error: error.message })
    return { scheduled: false, scheduledFor: null }
  }

  const scheduledFor = (data?.scheduled_for_deletion_at as string | null) ?? null
  return { scheduled: !!scheduledFor, scheduledFor }
}

export async function scheduleAccountDeletion(
  userId: string,
  userEmail: string,
  siteUrl: string,
): Promise<{ scheduledFor: string }> {
  // 1. Check not already scheduled
  const status = await getAccountDeletionStatus(userId)
  if (status.scheduled) throw new Error('Account is already scheduled for deletion')

  // 2. Check all owned workspaces
  const { data: ownedWorkspaces, error: wsError } = await supabaseAdmin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .eq('role', 'owner')

  if (wsError) throw new Error(`Failed to fetch owned workspaces: ${wsError.message}`)

  const typedOwnedWorkspaces = (ownedWorkspaces ?? []) as { workspace_id: string }[]

  for (const ws of typedOwnedWorkspaces) {
    // Check for pending ownership transfer
    const pendingTransfer = await getPendingTransfer(ws.workspace_id)
    if (pendingTransfer) {
      throw new Error('You have a pending ownership transfer. Cancel or complete it before deleting your account.')
    }

    // Check for other members
    const { count, error: countError } = await supabaseAdmin
      .from('workspace_members')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ws.workspace_id)
      .neq('user_id', userId)

    if (countError) throw new Error(`Failed to check workspace members: ${countError.message}`)
    if ((count ?? 0) > 0) {
      throw new Error('You own a workspace with other members. Transfer ownership or delete the workspace first.')
    }
  }

  // 3. Schedule deletion (now + 7 days)
  const scheduledFor = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  // 4. Schedule owned workspaces for deletion
  for (const ws of typedOwnedWorkspaces) {
    // Cancel Whop subscription if active
    try {
      await cancelSubscription(ws.workspace_id, false)
    } catch {
      // Subscription may not exist or already cancelled — continue
    }

    await supabaseAdmin
      .from('workspaces')
      .update({ scheduled_for_deletion_at: scheduledFor })
      .eq('id', ws.workspace_id)
  }

  // 5. Schedule account deletion
  const { error: updateError } = await supabaseAdmin
    .from('user_profiles')
    .update({ scheduled_for_deletion_at: scheduledFor })
    .eq('user_id', userId)

  if (updateError) throw new Error(`Failed to schedule deletion: ${updateError.message}`)

  // 6. Log event
  await supabaseAdmin.from('account_deletion_log').insert({
    user_id: userId,
    user_email: userEmail,
    event: 'scheduled',
    metadata: {
      owned_workspaces: typedOwnedWorkspaces.map((w) => w.workspace_id),
      scheduled_for: scheduledFor,
    },
  })

  // 7. Send confirmation email
  await sendDeletionScheduledEmail({
    to: userEmail,
    scheduledFor,
    dashboardUrl: siteUrl,
  })

  return { scheduledFor }
}

export async function cancelAccountDeletion(
  userId: string,
  userEmail: string,
): Promise<void> {
  const status = await getAccountDeletionStatus(userId)
  if (!status.scheduled) throw new Error('No deletion is scheduled')

  // 1. Clear account deletion schedule
  const { error: updateError } = await supabaseAdmin
    .from('user_profiles')
    .update({ scheduled_for_deletion_at: null })
    .eq('user_id', userId)

  if (updateError) throw new Error(`Failed to cancel deletion: ${updateError.message}`)

  // 2. Clear workspace deletion schedules for owned workspaces
  const { data: ownedWorkspaces } = await supabaseAdmin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .eq('role', 'owner')

  for (const ws of (ownedWorkspaces ?? []) as { workspace_id: string }[]) {
    await supabaseAdmin
      .from('workspaces')
      .update({ scheduled_for_deletion_at: null })
      .eq('id', ws.workspace_id)
  }

  // 3. Log cancellation
  await supabaseAdmin.from('account_deletion_log').insert({
    user_id: userId,
    user_email: userEmail,
    event: 'cancelled',
  })
}

export async function executeAccountDeletion(
  userId: string,
  userEmail: string,
): Promise<void> {
  // 1. Fetch all workspace memberships
  const { data: memberships, error: memError } = await supabaseAdmin
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', userId)

  if (memError) throw new Error(`Failed to fetch memberships: ${memError.message}`)

  const ownedWorkspaceIds: string[] = []
  const memberWorkspaceIds: string[] = []

  for (const m of (memberships ?? []) as { workspace_id: string; role: string }[]) {
    if (m.role === 'owner') {
      ownedWorkspaceIds.push(m.workspace_id)
    } else {
      memberWorkspaceIds.push(m.workspace_id)
    }
  }

  // 2. Anonymize in non-owned workspaces
  for (const workspaceId of memberWorkspaceIds) {
    const { error } = await supabaseAdmin.rpc('anonymize_workspace_member', {
      p_user_id: userId,
      p_workspace_id: workspaceId,
    })
    if (error) {
      logger.error('[account-deletion]', 'anonymize failed', { workspaceId, error: error.message })
      throw new Error(`Anonymization failed for workspace ${workspaceId}: ${error.message}`)
    }
  }

  // 3. Delete pending workspace invites
  await supabaseAdmin
    .from('workspace_invites')
    .delete()
    .eq('invited_by', userId)

  // 4. Delete owned workspaces (CASCADE handles all child data)
  for (const workspaceId of ownedWorkspaceIds) {
    const { error } = await supabaseAdmin
      .from('workspaces')
      .delete()
      .eq('id', workspaceId)

    if (error) {
      logger.error('[account-deletion]', 'workspace delete failed', { workspaceId, error: error.message })
      throw new Error(`Workspace deletion failed: ${error.message}`)
    }
  }

  // 5. Delete user_profiles row
  await supabaseAdmin
    .from('user_profiles')
    .delete()
    .eq('user_id', userId)

  // 6. Send completion email before deleting auth user
  await sendDeletionCompletedEmail({ to: userEmail })

  // 7. Delete auth user
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (authError) throw new Error(`Failed to delete auth user: ${authError.message}`)

  // 8. Log completion
  await supabaseAdmin.from('account_deletion_log').insert({
    user_id: userId,
    user_email: userEmail,
    event: 'deleted',
    metadata: {
      owned_workspaces_deleted: ownedWorkspaceIds,
      workspaces_anonymized: memberWorkspaceIds,
    },
  })
}
