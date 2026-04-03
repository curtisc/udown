export default function FeedLoading() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="h-7 w-24 animate-pulse rounded-lg bg-[var(--bg-surface)]" />
        <div className="h-9 w-28 animate-pulse rounded-lg bg-[var(--bg-surface)]" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl bg-[var(--bg-card)] p-4 space-y-3">
            <div className="h-5 w-3/4 animate-pulse rounded bg-[var(--bg-surface)]" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--bg-surface)]" />
            <div className="flex gap-2">
              <div className="h-7 w-7 animate-pulse rounded-full bg-[var(--bg-surface)]" />
              <div className="h-7 w-7 animate-pulse rounded-full bg-[var(--bg-surface)]" />
              <div className="h-7 w-7 animate-pulse rounded-full bg-[var(--bg-surface)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
