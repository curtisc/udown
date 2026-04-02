import Link from 'next/link'

type GroupCardProps = {
  group: {
    id: string
    name: string
    description: string | null
    isDefault: boolean
    _count: { members: number; events: number }
  }
  isMember: boolean
}

export function GroupCard({ group, isMember }: GroupCardProps) {
  return (
    <Link
      href={`/groups/${group.id}`}
      className="block rounded-xl bg-[var(--bg-card)] p-4 transition-colors hover:bg-[var(--bg-surface)]"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-[var(--text-primary)] truncate">
              {group.name}
            </h3>
            {group.isDefault && (
              <span className="shrink-0 rounded-full bg-[var(--brand-accent)]/20 px-2 py-0.5 text-xs font-medium text-[var(--brand-accent)]">
                Main
              </span>
            )}
          </div>
          {group.description && (
            <p className="mt-1 text-sm text-[var(--text-secondary)] line-clamp-2">
              {group.description}
            </p>
          )}
        </div>
        {isMember && (
          <span className="ml-2 shrink-0 rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
            Joined
          </span>
        )}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-[var(--text-secondary)]">
        <span>{group._count.members} member{group._count.members !== 1 ? 's' : ''}</span>
        <span>{group._count.events} event{group._count.events !== 1 ? 's' : ''}</span>
      </div>
    </Link>
  )
}
