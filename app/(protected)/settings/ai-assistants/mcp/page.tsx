'use client'

import { MCPSettings } from '@/components/features/settings/ai-assistants/mcp/mcp-settings'

// Static route — takes precedence over app/(protected)/settings/[category]/[page]
// which otherwise renders the "this page is being built" placeholder for
// ai-assistants/mcp.
export default function MCPPage() {
  return <MCPSettings />
}
