import type { Role } from '@/types/database'

export interface McpToolContext {
  userId: string
  workspaceId: string
  role: Role
}
