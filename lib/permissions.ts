// Role hierarchy: owner > admin > agent > observer
// owner   — full access including billing; 1 per workspace
// admin   — workspace + member management; no billing
// agent   — reply to tickets, use Shopify integration; no settings
// observer — view-only; cannot reply or change anything

type Role = string

export const can = {
  // Member management (owner cannot be removed; self cannot be removed)
  inviteMembers:   (role: Role) => ['owner', 'admin'].includes(role),
  removeMembers:   (role: Role) => ['owner', 'admin'].includes(role),
  // Role changes allowed by owner + admin; enforced in API: cannot change owner role
  changeRole:      (role: Role) => ['owner', 'admin'].includes(role),

  // Workspace settings (name, integrations, etc.)
  manageWorkspace: (role: Role) => ['owner', 'admin'].includes(role),

  // Billing — owner only
  manageBilling:   (role: Role) => role === 'owner',
  deleteWorkspace: (role: Role) => role === 'owner',

  // Ticket operations
  replyToTickets:  (role: Role) => ['owner', 'admin', 'agent'].includes(role),
  viewTickets:     (_role: Role) => true,  // all four roles can view

  // Macros — observers are read-only; agents+ can create/edit/archive
  viewMacros:      (_role: Role) => true,
  manageMacros:    (role: Role) => ['owner', 'admin', 'agent'].includes(role),
  // Hard delete is destructive — restrict to owner/admin
  deleteMacros:    (role: Role) => ['owner', 'admin'].includes(role),

  // Tags — same matrix as macros
  viewTags:        (_role: Role) => true,
  manageTags:      (role: Role) => ['owner', 'admin', 'agent'].includes(role),
  // Delete + merge are destructive (cascade through macro_tags)
  deleteTags:      (role: Role) => ['owner', 'admin'].includes(role),
}
