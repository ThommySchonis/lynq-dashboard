// Role hierarchy: owner > admin > agent > observer
// owner   — full access including billing; 1 per workspace
// admin   — workspace + member management; no billing
// agent   — reply to tickets, use Shopify integration; no settings
// observer — view-only; cannot reply or change anything

export const can = {
  // Member management (owner cannot be removed; self cannot be removed)
  inviteMembers:   (role) => ['owner', 'admin'].includes(role),
  removeMembers:   (role) => ['owner', 'admin'].includes(role),
  // Role changes allowed by owner + admin; enforced in API: cannot change owner role
  changeRole:      (role) => ['owner', 'admin'].includes(role),

  // Workspace settings (name, integrations, etc.)
  manageWorkspace: (role) => ['owner', 'admin'].includes(role),

  // Billing — owner only
  manageBilling:   (role) => role === 'owner',
  deleteWorkspace: (role) => role === 'owner',

  // Ticket operations
  replyToTickets:  (role) => ['owner', 'admin', 'agent'].includes(role),
  viewTickets:     (_role) => true,  // all four roles can view
}
