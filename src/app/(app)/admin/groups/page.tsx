import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export default async function AdminGroupsPage() {
  const groups = await prisma.group.findMany({
    include: {
      _count: { select: { members: true, events: true } },
      owner: { select: { name: true } },
    },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  })

  const now = new Date()

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const daysSinceEvent = group.lastEventAt
          ? Math.floor((now.getTime() - group.lastEventAt.getTime()) / (1000 * 60 * 60 * 24))
          : null
        const isInactive = daysSinceEvent !== null && daysSinceEvent > group.inactivityThresholdDays

        return (
          <Link
            key={group.id}
            href={`/groups/${group.slug}`}
            className="flex items-center justify-between rounded-lg bg-[var(--bg-card)] px-4 py-3 transition-colors hover:bg-[var(--bg-surface)]"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">{group.name}</span>
                {group.isDefault && (
                  <span className="rounded-full bg-[var(--brand-accent)]/20 px-2 py-0.5 text-xs text-[var(--brand-accent)]">Main</span>
                )}
                {isInactive && (
                  <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400">Inactive</span>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                {group._count.members} members · {group._count.events} events · Owner: {group.owner.name}
              </p>
            </div>
            <span className="text-xs text-[var(--text-secondary)]">
              {group.lastEventAt
                ? daysSinceEvent === 0
                  ? 'Last event today'
                  : daysSinceEvent === 1
                    ? 'Last event yesterday'
                    : `Last event ${daysSinceEvent}d ago`
                : 'No events'}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
