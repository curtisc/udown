export default function EventLoading() {
  return (
    <div className="space-y-6">
      <div className="h-4 w-24 animate-pulse rounded bg-[var(--bg-surface)]" />
      <div className="space-y-2">
        <div className="h-8 w-3/4 animate-pulse rounded-lg bg-[var(--bg-surface)]" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-[var(--bg-surface)]" />
      </div>
      <div className="rounded-xl bg-[var(--bg-card)] p-4 space-y-2">
        <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--bg-surface)]" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--bg-surface)]" />
      </div>
      <div className="rounded-xl bg-[var(--bg-card)] p-4">
        <div className="flex gap-2">
          <div className="h-10 flex-1 animate-pulse rounded-lg bg-[var(--bg-surface)]" />
          <div className="h-10 flex-1 animate-pulse rounded-lg bg-[var(--bg-surface)]" />
          <div className="h-10 flex-1 animate-pulse rounded-lg bg-[var(--bg-surface)]" />
        </div>
      </div>
    </div>
  )
}
