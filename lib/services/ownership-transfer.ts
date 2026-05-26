import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { OwnershipTransfer } from '@/types/database'
import { logger } from '@/lib/logger'

/** Get the pending transfer for a workspace, marking expired ones lazily. */
export async function getPendingTransfer(workspaceId: string): Promise<OwnershipTransfer | null> {
  const result = await supabaseAdmin
    .from('ownership_transfers')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'pending')
    .maybeSingle()

  if (result.error) {
    logger.error('[ownership-transfer]', 'getPending failed', { error: result.error.message })
    return null
  }
  if (!result.data) return null

  const transfer = result.data as OwnershipTransfer

  // Lazy expiration check
  if (new Date(transfer.expires_at) <= new Date()) {
    await supabaseAdmin
      .from('ownership_transfers')
      .update({ status: 'expired', resolved_at: new Date().toISOString() })
      .eq('id', transfer.id)
    return null
  }

  // Check that target member still exists in the workspace
  const { data: targetMember } = await supabaseAdmin
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', transfer.to_user_id)
    .maybeSingle()

  if (!targetMember) {
    await supabaseAdmin
      .from('ownership_transfers')
      .update({ status: 'cancelled', resolved_at: new Date().toISOString() })
      .eq('id', transfer.id)
    return null
  }

  return transfer
}

/** Initiate a new ownership transfer. Caller must be owner. */
export async function initiateTransfer(
  workspaceId: string,
  fromUserId: string,
  toUserId: string,
  newRoleForOldOwner: string,
): Promise<OwnershipTransfer> {
  // Validate target is an existing non-owner member
  const { data: targetMember, error: memberError } = await supabaseAdmin
    .from('workspace_members')
    .select('id, role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', toUserId)
    .maybeSingle()

  if (memberError) throw new Error(`Member lookup failed: ${memberError.message}`)
  if (!targetMember) throw new Error('Target user is not a member of this workspace')

  const member = targetMember as { id: string; role: string }
  if (member.role === 'owner') throw new Error('Cannot transfer ownership to the current owner')

  // Check no pending transfer exists
  const existing = await getPendingTransfer(workspaceId)
  if (existing) throw new Error('A pending transfer already exists for this workspace')

  const insertResult = await supabaseAdmin
    .from('ownership_transfers')
    .insert({
      workspace_id: workspaceId,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      new_role_for_old_owner: newRoleForOldOwner,
    })
    .select()
    .single()

  if (insertResult.error) throw new Error(`Failed to create transfer: ${insertResult.error.message}`)
  return insertResult.data as OwnershipTransfer
}

/** Cancel a pending transfer. Caller must be the initiator (from_user_id). */
export async function cancelTransfer(workspaceId: string, userId: string): Promise<void> {
  const transfer = await getPendingTransfer(workspaceId)
  if (!transfer) throw new Error('No pending transfer found')
  if (transfer.from_user_id !== userId) throw new Error('Only the initiator can cancel the transfer')

  const { error } = await supabaseAdmin
    .from('ownership_transfers')
    .update({ status: 'cancelled', resolved_at: new Date().toISOString() })
    .eq('id', transfer.id)

  if (error) throw new Error(`Failed to cancel transfer: ${error.message}`)
}

/** Accept a pending transfer. Caller must be the target (to_user_id). */
export async function acceptTransfer(workspaceId: string, userId: string): Promise<void> {
  const transfer = await getPendingTransfer(workspaceId)
  if (!transfer) throw new Error('No pending transfer found')
  if (transfer.to_user_id !== userId) throw new Error('Only the target member can accept the transfer')

  const { error } = await supabaseAdmin.rpc('accept_ownership_transfer', {
    p_transfer_id: transfer.id,
  })

  if (error) throw new Error(`Failed to accept transfer: ${error.message}`)
}

/** Decline a pending transfer. Caller must be the target (to_user_id). */
export async function declineTransfer(workspaceId: string, userId: string): Promise<void> {
  const transfer = await getPendingTransfer(workspaceId)
  if (!transfer) throw new Error('No pending transfer found')
  if (transfer.to_user_id !== userId) throw new Error('Only the target member can decline the transfer')

  const { error } = await supabaseAdmin
    .from('ownership_transfers')
    .update({ status: 'declined', resolved_at: new Date().toISOString() })
    .eq('id', transfer.id)

  if (error) throw new Error(`Failed to decline transfer: ${error.message}`)
}
