'use client'

import { Fragment, useState } from 'react'
import { useCronRunsLatest, useCronRuns, useCronRunsRealtime } from '@/hooks/admin/use-cron-jobs'
import type { CronJobRun } from '@/types/admin'
import { CheckCircle2, AlertTriangle, XCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react'

const JOB_NAMES = [
  'data-retention',
  'trial-expiry',
  'usage-warnings',
  'gmail-watch-renewal',
  'shopify-sync',
  'shopify-webhook',
  'webhook-cleanup',
  'webhook-retry',
] as const

const JOB_LABELS: Record<string, string> = {
  'data-retention': 'Data Retention',
  'trial-expiry': 'Trial Expiry',
  'usage-warnings': 'Usage Warnings',
  'gmail-watch-renewal': 'Gmail Watch Renewal',
  'shopify-sync': 'Shopify Sync',
  'shopify-webhook': 'Shopify Webhook',
  'webhook-cleanup': 'Webhook Cleanup',
  'webhook-retry': 'Webhook Retry',
}

const JOB_SCHEDULES: Record<string, string> = {
  'data-retention': 'Daily 03:00 UTC',
  'trial-expiry': 'Daily 03:30 UTC',
  'usage-warnings': 'Hourly',
  'gmail-watch-renewal': 'External trigger',
  'shopify-sync': 'External trigger',
  'shopify-webhook': 'Webhook-triggered',
  'webhook-cleanup': 'External trigger',
  'webhook-retry': 'External trigger',
}

const STALE_THRESHOLD_MS = 10 * 60 * 1000 // 10 minutes

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function isStale(run: CronJobRun): boolean {
  return (
    run.status === 'running' &&
    Date.now() - new Date(run.started_at).getTime() > STALE_THRESHOLD_MS
  )
}

function StatusBadge({ run }: { run: CronJobRun }) {
  if (isStale(run)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
        <XCircle size={12} /> Stale
      </span>
    )
  }

  const config = {
    running: { icon: Loader2, className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', spin: true },
    success: { icon: CheckCircle2, className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', spin: false },
    warning: { icon: AlertTriangle, className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', spin: false },
    failure: { icon: XCircle, className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', spin: false },
  }[run.status]

  const Icon = config.icon

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}>
      <Icon size={12} className={config.spin ? 'animate-spin' : ''} /> {run.status}
    </span>
  )
}

function JobCard({ jobName, latestRun }: { jobName: string; latestRun?: CronJobRun }) {
  const hasProblem = latestRun && (latestRun.status === 'failure' || latestRun.status === 'warning' || isStale(latestRun))

  return (
    <div className={`rounded-xl border p-4 transition-colors ${
      hasProblem
        ? 'border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20'
        : 'border-border bg-card'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-foreground">{JOB_LABELS[jobName] ?? jobName}</h3>
        {latestRun ? <StatusBadge run={latestRun} /> : (
          <span className="text-xs text-muted-foreground">No runs</span>
        )}
      </div>
      <div className="text-xs text-muted-foreground space-y-0.5">
        <div>{JOB_SCHEDULES[jobName] ?? 'Unknown'}</div>
        {latestRun && (
          <div>{timeAgo(latestRun.started_at)}{latestRun.duration_ms != null && ` \u00B7 ${latestRun.duration_ms}ms`}</div>
        )}
      </div>
    </div>
  )
}

function ExpandedRow({ run }: { run: CronJobRun }) {
  return (
    <tr>
      <td colSpan={6} className="px-4 py-3 bg-muted/30">
        <div className="space-y-2 text-xs">
          {run.summary && (
            <div>
              <span className="font-medium text-foreground">Summary:</span>
              <pre className="mt-1 p-2 rounded bg-muted text-muted-foreground overflow-x-auto">
                {JSON.stringify(run.summary, null, 2)}
              </pre>
            </div>
          )}
          {run.error_message && (
            <div>
              <span className="font-medium text-red-600 dark:text-red-400">Error:</span>
              <pre className="mt-1 p-2 rounded bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 overflow-x-auto">
                {run.error_message}
              </pre>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

export function CronJobsView() {
  const { data: latestRuns, isLoading: latestLoading } = useCronRunsLatest()
  const [jobFilter, setJobFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: historyRuns, isLoading: historyLoading } = useCronRuns({
    jobName: jobFilter || undefined,
    status: statusFilter || undefined,
  })

  // Enable real-time updates
  useCronRunsRealtime()

  const latestByJob = new Map<string, CronJobRun>()
  for (const run of latestRuns ?? []) {
    latestByJob.set(run.job_name, run)
  }

  return (
    <div className="space-y-6">
      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {JOB_NAMES.map((name) => (
          <JobCard key={name} jobName={name} latestRun={latestByJob.get(name)} />
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={jobFilter}
          onChange={(e) => setJobFilter(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">All Jobs</option>
          {JOB_NAMES.map((name) => (
            <option key={name} value={name}>{JOB_LABELS[name]}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">All Statuses</option>
          <option value="success">Success</option>
          <option value="warning">Warning</option>
          <option value="failure">Failure</option>
          <option value="running">Running</option>
        </select>
      </div>

      {/* History Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-8" />
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Job</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Started</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Duration</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Summary</th>
            </tr>
          </thead>
          <tbody>
            {(latestLoading || historyLoading) && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  <Loader2 size={16} className="animate-spin inline mr-2" />
                  Loading runs...
                </td>
              </tr>
            )}
            {!historyLoading && (!historyRuns || historyRuns.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No runs found
                </td>
              </tr>
            )}
            {historyRuns?.map((run) => {
              const isExpanded = expandedId === run.id
              const hasSummaryOrError = run.summary || run.error_message
              return (
                <Fragment key={run.id}>
                  <tr
                    className={`border-b border-border last:border-0 ${hasSummaryOrError ? 'cursor-pointer hover:bg-muted/20' : ''}`}
                    onClick={() => hasSummaryOrError && setExpandedId(isExpanded ? null : run.id)}
                  >
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {hasSummaryOrError && (
                        isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-foreground font-medium">
                      {JOB_LABELS[run.job_name] ?? run.job_name}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge run={run} />
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {timeAgo(run.started_at)}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {run.duration_ms != null ? `${run.duration_ms}ms` : '\u2014'}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[200px]">
                      {run.summary ? JSON.stringify(run.summary) : '\u2014'}
                    </td>
                  </tr>
                  {isExpanded && hasSummaryOrError && <ExpandedRow run={run} />}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
