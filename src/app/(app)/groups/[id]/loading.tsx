export default function GroupDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="h-4 w-24 animate-pulse rounded bg-[var(--bg-surface)]" />
      <div className="space-y-2">
        <div className="h-8 w-1/2 animate-pulse rounded-lg bg-[var(--bg-surface)]" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--bg-surface)]" />
        <div className="h-4 w-1/4 animate-pulse rounded bg-[var(--bg-surface)]" />
      </div>
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-xl bg-[var(--bg-card)] p-4 space-y-2">
            <div className="h-5 w-3/4 animate-pulse rounded bg-[var(--bg-surface)]" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--bg-surface)]" />
          </div>
        ))}
      </div>
    </div>
  )
}
