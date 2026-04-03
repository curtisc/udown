export default function AdminLoading() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-start gap-3 rounded-lg bg-[var(--bg-card)] px-4 py-3">
          <div className="h-7 w-7 animate-pulse rounded-full bg-[var(--bg-surface)]" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--bg-surface)]" />
            <div className="h-3 w-16 animate-pulse rounded bg-[var(--bg-surface)]" />
          </div>
        </div>
      ))}
    </div>
  )
}
