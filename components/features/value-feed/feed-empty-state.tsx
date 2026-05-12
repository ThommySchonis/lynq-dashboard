interface FeedEmptyStateProps {
  hasFilter: boolean
  onClear: () => void
}

export function FeedEmptyState({ hasFilter, onClear }: FeedEmptyStateProps) {
  return (
    <div
      className="opacity-0 animate-fade-up-quick motion-reduce:opacity-100 motion-reduce:animate-none px-6 py-[72px] text-center"
      style={{ animationDelay: '700ms' }}
    >
      <div className="mb-1.5 text-base font-semibold text-[#0A0612]">
        Nothing here yet
      </div>
      <div className="mx-auto max-w-[360px] text-sm text-[#6B6B66]">
        {hasFilter
          ? 'No posts match this filter.'
          : 'Your Lynq team will post exclusive content here soon.'}
      </div>
      {hasFilter && (
        <button
          type="button"
          onClick={onClear}
          className="mt-5 cursor-pointer rounded-[10px] border border-[#EFEDE8] bg-white px-4 py-2 font-[inherit] text-[13px] font-medium text-[#2A2825] transition-colors duration-150 hover:bg-[#F5F4F0]"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
