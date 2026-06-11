'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useStartMigration } from '@/hooks/useMigrations'

interface Props {
  migrationId: string
  onSuccess: () => void
}

type Preset = 'all' | '12m' | '3m' | 'custom'

function presetToRange(p: Preset, customStart: string, customEnd: string): { start: string; end: string } {
  const now = new Date()
  if (p === 'all')    return { start: new Date(2000, 0, 1).toISOString(), end: now.toISOString() }
  if (p === '12m')    return { start: new Date(now.getTime() - 365 * 86400000).toISOString(), end: now.toISOString() }
  if (p === '3m')     return { start: new Date(now.getTime() -  90 * 86400000).toISOString(), end: now.toISOString() }
  return { start: new Date(customStart).toISOString(), end: new Date(customEnd).toISOString() }
}

export function ChooseTimeRange({ migrationId, onSuccess }: Props) {
  const [preset, setPreset] = useState<Preset>('12m')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const startMut = useStartMigration(migrationId)

  function submit() {
    const range = presetToRange(preset, customStart, customEnd)
    void startMut.mutateAsync({ time_range_start: range.start, time_range_end: range.end }).then(() => {
      onSuccess()
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">How far back should we import?</h2>
        <p className="text-sm text-foreground-3">Conversations created in this window will be imported.</p>
      </div>

      <RadioGroup value={preset} onValueChange={(v) => setPreset(v as Preset)} className="space-y-2">
        <div className="flex items-center gap-2"><RadioGroupItem value="all" id="r-all" /><Label htmlFor="r-all">All time</Label></div>
        <div className="flex items-center gap-2"><RadioGroupItem value="12m" id="r-12m" /><Label htmlFor="r-12m">Last 12 months</Label></div>
        <div className="flex items-center gap-2"><RadioGroupItem value="3m" id="r-3m" /><Label htmlFor="r-3m">Last 3 months</Label></div>
        <div className="flex items-center gap-2"><RadioGroupItem value="custom" id="r-cu" /><Label htmlFor="r-cu">Custom range</Label></div>
      </RadioGroup>

      {preset === 'custom' && (
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Start</Label><Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} /></div>
          <div><Label>End</Label><Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} /></div>
        </div>
      )}

      {startMut.error && <p className="text-sm text-destructive">{startMut.error.message}</p>}

      <Button onClick={submit} disabled={startMut.isPending || (preset === 'custom' && (!customStart || !customEnd))} className="w-full">
        {startMut.isPending ? 'Starting…' : 'Start import'}
      </Button>
    </div>
  )
}
