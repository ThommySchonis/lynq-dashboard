type Role = 'owner' | 'admin' | 'agent' | 'observer'

export const can = {
  inviteMembers:   (role: Role) => ['owner', 'admin'].includes(role),
  removeMembers:   (role: Role) => ['owner', 'admin'].includes(role),
  changeRole:      (role: Role) => ['owner', 'admin'].includes(role),
  manageWorkspace: (role: Role) => ['owner', 'admin'].includes(role),
  manageBilling:   (role: Role) => role === 'owner',
  deleteWorkspace: (role: Role) => role === 'owner',
  replyToTickets:  (role: Role) => ['owner', 'admin', 'agent'].includes(role),
  viewTickets:     (_role: Role) => true,
  viewMacros:      (_role: Role) => true,
  manageMacros:    (role: Role) => ['owner', 'admin', 'agent'].includes(role),
  deleteMacros:    (role: Role) => ['owner', 'admin'].includes(role),
  manageTags:      (role: Role) => ['owner', 'admin', 'agent'].includes(role),
  manageTasks:     (role: Role) => ['owner', 'admin', 'agent'].includes(role),
}
