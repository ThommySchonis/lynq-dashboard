'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

interface ExportFormat {
  label: string
  value: string
}

interface ExportButtonProps {
  formats: ExportFormat[]
  onExport: (format: string) => Promise<void>
}

export function ExportButton({ formats, onExport }: ExportButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleExport(format: string) {
    setLoading(true)
    try {
      await onExport(format)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={loading}
        render={
          <Button variant="outline" size="sm" disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            <span className="ml-1.5">Export</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={4}>
        {formats.map(f => (
          <DropdownMenuItem
            key={f.value}
            onClick={() => void handleExport(f.value)}
          >
            {f.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
