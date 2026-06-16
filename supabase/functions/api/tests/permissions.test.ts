import { assertEquals } from '@std/assert'
import { can } from '../lib/permissions.ts'

const ROLES = ['owner', 'admin', 'agent', 'observer'] as const

Deno.test('observer is view-only: every write capability denies observer', () => {
  const writeCaps = [
    'inviteMembers', 'removeMembers', 'changeRole', 'manageWorkspace',
    'manageBilling', 'deleteWorkspace', 'replyToTickets', 'manageConversations',
    'manageOrders', 'manageMacros', 'deleteMacros', 'manageTags', 'deleteTags',
    'manageTasks', 'deleteTasks', 'manageMigrations',
  ] as const
  for (const cap of writeCaps) {
    assertEquals(can[cap]('observer'), false, `observer must be denied ${cap}`)
  }
})

Deno.test('operational writes allow agent, deny observer', () => {
  for (const cap of ['replyToTickets', 'manageConversations', 'manageOrders'] as const) {
    assertEquals(can[cap]('agent'), true, `agent allowed ${cap}`)
    assertEquals(can[cap]('admin'), true)
    assertEquals(can[cap]('owner'), true)
    assertEquals(can[cap]('observer'), false)
  }
})

Deno.test('admin writes deny agent and observer', () => {
  for (const cap of ['manageWorkspace', 'inviteMembers', 'manageMigrations'] as const) {
    assertEquals(can[cap]('admin'), true, `admin allowed ${cap}`)
    assertEquals(can[cap]('owner'), true)
    assertEquals(can[cap]('agent'), false, `agent denied ${cap}`)
    assertEquals(can[cap]('observer'), false)
  }
})

Deno.test('billing + delete workspace are owner only', () => {
  for (const cap of ['manageBilling', 'deleteWorkspace'] as const) {
    assertEquals(can[cap]('owner'), true)
    assertEquals(can[cap]('admin'), false, `admin denied ${cap}`)
    assertEquals(can[cap]('agent'), false)
    assertEquals(can[cap]('observer'), false)
  }
})

Deno.test('view capabilities allow all roles', () => {
  for (const role of ROLES) {
    assertEquals(can.viewTickets(role), true)
    assertEquals(can.viewMacros(role), true)
    assertEquals(can.viewTags(role), true)
    assertEquals(can.viewTasks(role), true)
  }
})
