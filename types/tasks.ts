export interface Task {
  id: string
  workspaceId: string
  title: string
  description: string | null
  category: string | null
  priority: 'high' | 'medium' | 'low'
  status: 'open' | 'picked_up' | 'done'
  assignedTo: string | null
  assignedMemberName: string | null
  pickedUpAt: string | null
  completedAt: string | null
  resultNote: string | null
  shopifyOrderId: string | null
  shopifyOrderName: string | null
  shopifyCustomerId: string | null
  customerName: string | null
  customerEmail: string | null
  triggerType: 'manual' | 'pattern' | 'ai_insight'
  triggerKey: string | null
  createdBy: string | null
  refundCount: number | null
  totalAmount: number | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateTaskInput {
  title: string
  description?: string
  category?: string
  priority?: 'high' | 'medium' | 'low'
  assignedTo?: string
  shopifyOrderId?: string
  shopifyOrderName?: string
  shopifyCustomerId?: string
  customerName?: string
  customerEmail?: string
}

export interface UpdateTaskInput {
  status?: 'open' | 'picked_up' | 'done'
  assignedTo?: string | null
  resultNote?: string
  title?: string
  description?: string
  priority?: 'high' | 'medium' | 'low'
  category?: string
}

export interface TaskFilters {
  status?: 'open' | 'picked_up' | 'done'
  assignee?: string
  priority?: 'high' | 'medium' | 'low'
  limit?: number
  offset?: number
}
