export type Role = 'owner' | 'admin' | 'agent' | 'observer'

export const can = {
  // Member management
  inviteMembers:   (role: Role) => ['owner', 'admin'].includes(role),
  removeMembers:   (role: Role) => ['owner', 'admin'].includes(role),
  changeRole:      (role: Role) => ['owner', 'admin'].includes(role),

  // Workspace settings, integrations, connections
  manageWorkspace: (role: Role) => ['owner', 'admin'].includes(role),

  // Billing — owner only
  manageBilling:   (role: Role) => role === 'owner',
  deleteWorkspace: (role: Role) => role === 'owner',

  // Ticket operations
  replyToTickets:      (role: Role) => ['owner', 'admin', 'agent'].includes(role),
  manageConversations: (role: Role) => ['owner', 'admin', 'agent'].includes(role),
  viewTickets:         (_role: Role) => true,

  // Shopify order write actions
  manageOrders:    (role: Role) => ['owner', 'admin', 'agent'].includes(role),

  // Macros
  viewMacros:      (_role: Role) => true,
  manageMacros:    (role: Role) => ['owner', 'admin', 'agent'].includes(role),
  deleteMacros:    (role: Role) => ['owner', 'admin'].includes(role),

  // Tags
  viewTags:        (_role: Role) => true,
  manageTags:      (role: Role) => ['owner', 'admin', 'agent'].includes(role),
  deleteTags:      (role: Role) => ['owner', 'admin'].includes(role),

  // Tasks
  viewTasks:       (_role: Role) => true,
  manageTasks:     (role: Role) => ['owner', 'admin', 'agent'].includes(role),
  deleteTasks:     (role: Role) => ['owner', 'admin'].includes(role),

  // Workspace migrations
  manageMigrations: (role: Role) => ['owner', 'admin'].includes(role),
}
