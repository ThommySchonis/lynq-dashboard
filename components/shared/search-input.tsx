'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface SearchInputProps {
  placeholder?: string
  value?: string
  onChange: (value: string) => void
  debounceMs?: number
  className?: string
}

export function SearchInput({
  placeholder = 'Search...',
  value: controlledValue,
  onChange,
  debounceMs = 300,
  className,
}: SearchInputProps) {
  const [internal, setInternal] = useState(controlledValue ?? '')
  const isFirstRender = useRef(true)
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  useEffect(() => {
    if (controlledValue !== undefined) setInternal(controlledValue) // eslint-disable-line react-hooks/set-state-in-effect
  }, [controlledValue])

  useEffect(() => {
    // Skip firing onChange on initial mount
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const timer = setTimeout(() => onChangeRef.current(internal), debounceMs)
    return () => clearTimeout(timer)
  }, [internal, debounceMs])

  return (
    <div className={cn('relative', className)}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-4" />
      <Input
        value={internal}
        onChange={(e) => setInternal(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-8"
      />
      {internal && (
        <button
          onClick={() => { setInternal(''); onChange('') }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-4 hover:text-foreground-2"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
