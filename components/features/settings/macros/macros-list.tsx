'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, FileText, AlertCircle, Loader2, Sparkles } from 'lucide-react'
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useSettingsUI } from '@/stores/settings-ui'
import {
  useMacros,
  useMacroOnboarding,
} from '@/hooks/settings/use-settings-data'
import {
  useDuplicateMacro,
  useArchiveMacro,
  useRestoreMacro,
  useDeleteMacro,
  useGenerateMacros,
} from '@/hooks/settings/use-settings-mutations'
import { MacrosToolbar } from './macros-toolbar'
import { MacroRow } from './macro-row'
import type { Macro } from '@/types/inbox'

export function MacrosList() {
  const filter = useSettingsUI((s) => s.macroFilter)
  const setFilter = useSettingsUI((s) => s.setMacroFilter)

  const { data: macros, isLoading, error } = useMacros(filter)
  const { data: onboarding } = useMacroOnboarding()
  const hasOnboarding = !!onboarding?.completed_at

  const duplicateMut = useDuplicateMacro()
  const archiveMut = useArchiveMacro()
  const restoreMut = useRestoreMacro()
  const deleteMut = useDeleteMacro()
  const generateMut = useGenerateMacros()

  const [regenOpen, setRegenOpen] = useState(false)

  // TODO: derive from actual user role when available from the hook
  // For now the mutations handle permission checks server-side
  const canManage = true
  const canDelete = true

  const tabValue = filter.archived ? 'archived' : 'active'

  const hasFilters = !!(filter.search || filter.language || filter.tags.length)

  return (
    <div className="mx-auto max-w-[1100px] px-10 py-12">
      {/* Header */}
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Macros</h1>
          <p className="text-sm text-muted-foreground">
            Pre-made responses with variables. Apply to tickets with one click.
          </p>
        </div>
        {canManage && (
          <Button render={<Link href="/settings/workspace/macros/new" />}>
            <Plus size={16} strokeWidth={1.75} />
            Create macro
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          <span>{error.message}</span>
        </div>
      )}

      {/* Tabs */}
      <Tabs
        value={tabValue}
        onValueChange={(val) =>
          setFilter({ archived: val === 'archived' })
        }
      >
        <TabsList variant="line" className="mb-4">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>

        {/* Toolbar */}
        <div className="mb-4">
          <MacrosToolbar
            canManage={canManage}
            hasOnboarding={hasOnboarding}
            onRegenerate={() => setRegenOpen(true)}
          />
        </div>

        <TabsContent value="active">
          <MacrosTable
            macros={macros ?? []}
            isLoading={isLoading}
            canManage={canManage}
            canDelete={canDelete}
            hasFilters={hasFilters}
            tab="active"
            onDuplicate={(id) => duplicateMut.mutate(id)}
            onArchive={(id) => archiveMut.mutate(id)}
            onRestore={(id) => restoreMut.mutate(id)}
            onDelete={(id) => deleteMut.mutate(id)}
          />
        </TabsContent>

        <TabsContent value="archived">
          <MacrosTable
            macros={macros ?? []}
            isLoading={isLoading}
            canManage={canManage}
            canDelete={canDelete}
            hasFilters={hasFilters}
            tab="archived"
            onDuplicate={(id) => duplicateMut.mutate(id)}
            onArchive={(id) => archiveMut.mutate(id)}
            onRestore={(id) => restoreMut.mutate(id)}
            onDelete={(id) => deleteMut.mutate(id)}
          />
        </TabsContent>
      </Tabs>

      {/* Regenerate modal */}
      <Dialog open={regenOpen} onOpenChange={setRegenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate macros?</DialogTitle>
            <DialogDescription>
              {generateMut.isPending
                ? 'AI is crafting new macros -- about 30-60 seconds...'
                : 'This will generate ~50 new macros based on your saved store details. Your existing macros are not deleted -- the new ones will be added to the list.'}
            </DialogDescription>
          </DialogHeader>
          {generateMut.isPending && (
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
              Generating...
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRegenOpen(false)}
              disabled={generateMut.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => generateMut.mutate(undefined, { onSuccess: () => setRegenOpen(false) })}
              disabled={generateMut.isPending}
            >
              {generateMut.isPending ? (
                <>
                  <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles size={14} strokeWidth={1.75} />
                  Generate now
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ── Table sub-component ── */

interface MacrosTableProps {
  macros: Macro[]
  isLoading: boolean
  canManage: boolean
  canDelete: boolean
  hasFilters: boolean
  tab: 'active' | 'archived'
  onDuplicate: (id: string) => void
  onArchive: (id: string) => void
  onRestore: (id: string) => void
  onDelete: (id: string) => void
}

function MacrosTable({
  macros,
  isLoading,
  canManage,
  canDelete,
  hasFilters,
  tab,
  onDuplicate,
  onArchive,
  onRestore,
  onDelete,
}: MacrosTableProps) {
  if (isLoading) {
    return <MacrosTableSkeleton />
  }

  if (macros.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-xl bg-muted">
          <FileText size={28} strokeWidth={1.5} className="text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          {tab === 'archived'
            ? 'No archived macros'
            : hasFilters
              ? 'No macros match your filters'
              : 'No macros yet'}
        </h3>
        <p className="max-w-xs text-sm text-muted-foreground">
          {tab === 'archived'
            ? 'Macros you archive will appear here.'
            : hasFilters
              ? 'Try clearing some filters or searching for something different.'
              : 'Create your first macro to start replying faster.'}
        </p>
        {tab === 'active' && !hasFilters && canManage && (
          <Button className="mt-2" render={<Link href="/settings/workspace/macros/new" />}>
            <Plus size={16} strokeWidth={1.75} />
            Create your first macro
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Macro name</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>Language</TableHead>
            <TableHead>Usage</TableHead>
            <TableHead>Last updated</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {macros.map((m) => (
            <MacroRow
              key={m.id}
              macro={m}
              canManage={canManage}
              canDelete={canDelete}
              onDuplicate={onDuplicate}
              onArchive={onArchive}
              onRestore={onRestore}
              onDelete={onDelete}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function MacrosTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Macro name</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>Language</TableHead>
            <TableHead>Usage</TableHead>
            <TableHead>Last updated</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {[0, 1, 2].map((i) => (
            <TableRow key={i}>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <Skeleton className="size-8 rounded-lg" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-3 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-3 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-3 w-8" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-3 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-3 w-6" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
