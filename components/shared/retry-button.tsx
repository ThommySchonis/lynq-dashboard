'use client'

import { Button } from '@/components/ui/button'
import { RotateCw } from 'lucide-react'

interface RetryButtonProps {
  onRetry: () => void
  isRetrying?: boolean
  className?: string
}

export function RetryButton({ onRetry, isRetrying, className }: RetryButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onRetry}
      disabled={isRetrying}
      className={className}
    >
      <RotateCw className={`mr-1.5 h-3.5 w-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
      {isRetrying ? 'Retrying…' : 'Retry'}
    </Button>
  )
}
