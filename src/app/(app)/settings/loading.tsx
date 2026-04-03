export default function SettingsLoading() {
  return (
    <div className="space-y-8">
      <div className="h-7 w-24 animate-pulse rounded-lg bg-[var(--bg-surface)]" />
      <div className="rounded-xl bg-[var(--bg-card)] p-4">
        <div className="h-4 w-16 animate-pulse rounded bg-[var(--bg-surface)] mb-3" />
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 animate-pulse rounded-full bg-[var(--bg-surface)]" />
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-[var(--bg-surface)]" />
            <div className="h-3 w-48 animate-pulse rounded bg-[var(--bg-surface)]" />
          </div>
        </div>
      </div>
      <div className="rounded-xl bg-[var(--bg-card)] p-4 space-y-3">
        <div className="h-4 w-40 animate-pulse rounded bg-[var(--bg-surface)]" />
        <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--bg-surface)]" />
      </div>
    </div>
  )
}
