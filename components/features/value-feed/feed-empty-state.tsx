interface FeedEmptyStateProps {
  hasFilter: boolean
  onClear: () => void
}

export function FeedEmptyState({ hasFilter, onClear }: FeedEmptyStateProps) {
  return (
    <div className="opacity-0 animate-fade-up-quick motion-reduce:opacity-100 motion-reduce:animate-none px-6 py-[72px] text-center">
      <div className="mb-1.5 text-base font-semibold text-foreground">Nothing here yet</div>
      <div className="mx-auto max-w-[360px] text-sm text-foreground-3">
        {hasFilter
          ? 'No posts match this filter.'
          : 'Your Lynq team will post exclusive content here soon.'}
      </div>
      {hasFilter && (
        <button
          type="button"
          onClick={onClear}
          className="mt-5 cursor-pointer rounded-[10px] border border-border bg-card px-4 py-2 text-sm font-medium text-foreground-2 transition-colors hover:bg-muted"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
