'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAddAiLesson } from '@/hooks/ai'
import { SCENARIOS } from './scenarios-section'

// "All scenarios" sentinel for the scenario dropdown. Cannot use empty
// string because base-ui's Select treats '' as null/unset.
const ALL_SCENARIOS_VALUE = '__all__'

interface AddLessonDialogProps {
  storeId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddLessonDialog({ storeId, open, onOpenChange }: AddLessonDialogProps) {
  const addLesson = useAddAiLesson(storeId)
  const [text, setText] = useState('')
  const [scenario, setScenario] = useState<string>(ALL_SCENARIOS_VALUE)

  const trimmed = text.trim()
  const canSubmit = trimmed.length > 0 && !addLesson.isPending

  async function handleAdd() {
    if (!canSubmit) return
    await addLesson.mutateAsync({
      lesson_text:         trimmed,
      applies_to_scenario: scenario === ALL_SCENARIOS_VALUE ? null : scenario,
    })
    setText('')
    setScenario(ALL_SCENARIOS_VALUE)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add lesson</DialogTitle>
          <DialogDescription>
            Saved lessons are injected into Emma&rsquo;s prompt right after the scenarios section.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-lesson-text" className="text-sm font-medium text-foreground">
              Lesson
            </Label>
            <Textarea
              id="add-lesson-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What should Emma learn for this store?"
              rows={4}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-lesson-scenario" className="text-sm font-medium text-foreground">
              Applies to
            </Label>
            <Select value={scenario} onValueChange={(v) => v && setScenario(v)}>
              <SelectTrigger id="add-lesson-scenario" className="w-full">
                <SelectValue placeholder="All scenarios" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SCENARIOS_VALUE}>All scenarios</SelectItem>
                {SCENARIOS.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={() => void handleAdd()} disabled={!canSubmit}>
            {addLesson.isPending ? 'Adding…' : 'Add lesson'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
