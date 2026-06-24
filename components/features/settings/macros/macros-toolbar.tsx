'use client'

import Link from 'next/link'
import { Search, Sparkles, Tag } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSettingsUI } from '@/stores/settings-ui'
import { MACRO_LANGUAGES } from '@/lib/settings-constants'

interface MacrosToolbarProps {
  canManage: boolean
  hasOnboarding: boolean
  onRegenerate: () => void
}

export function MacrosToolbar({
  canManage,
  hasOnboarding,
  onRegenerate,
}: MacrosToolbarProps) {
  const filter = useSettingsUI((s) => s.macroFilter)
  const setFilter = useSettingsUI((s) => s.setMacroFilter)

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="relative min-w-[220px] max-w-[320px] flex-1">
        <Search
          size={14}
          strokeWidth={1.75}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="text"
          placeholder="Search macros..."
          value={filter.search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setFilter({ search: e.target.value })
          }
          className="bg-card pl-8"
        />
      </div>

      <Select
        value={filter.language || 'all'}
        onValueChange={(val) =>
          setFilter({ language: val === 'all' || val === null ? '' : val })
        }
      >
        <SelectTrigger className="bg-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MACRO_LANGUAGES.map((l) => (
            <SelectItem key={l.value || 'all'} value={l.value || 'all'}>
              {l.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="relative w-[200px]">
        <Tag
          size={14}
          strokeWidth={1.75}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="text"
          placeholder="Filter by tag..."
          value={filter.tags.join(', ')}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const tags = e.target.value
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
            setFilter({ tags })
          }}
          className="bg-card pl-8"
          title="Comma-separated tags"
        />
      </div>

      {canManage && (
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {hasOnboarding ? (
            <Button
              variant="outline"
              onClick={onRegenerate}
              className="bg-card text-primary hover:text-primary"
            >
              <Sparkles size={16} strokeWidth={1.75} />
              Regenerate
            </Button>
          ) : (
            <Button
              variant="outline"
              render={<Link href="/settings/workspace/macros/generate" />}
              className="bg-card text-primary hover:text-primary"
            >
              <Sparkles size={16} strokeWidth={1.75} />
              Generate from your store
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
