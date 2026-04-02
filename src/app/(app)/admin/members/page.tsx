import { prisma } from '@/lib/prisma'
import { MemberActions } from './member-actions'

export default async function MembersPage() {
  const defaultGroup = await prisma.group.findFirst({ where: { isDefault: true } })
  if (!defaultGroup) return null

  const members = await prisma.groupMember.findMany({
    where: { groupId: defaultGroup.id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          createdAt: true,
          groupMemberships: {
            select: { group: { select: { name: true } } },
          },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  })

  return (
    <div className="space-y-2">
      {members.map((m) => (
        <div key={m.userId} className="flex items-center justify-between rounded-lg bg-[var(--bg-card)] px-4 py-3">
          <div className="flex items-center gap-3">
            {m.user.image ? (
              <img src={m.user.image} alt={m.user.name || ''} className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-surface)] text-sm font-bold text-[var(--text-secondary)]">
                {(m.user.name || '?')[0].toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">{m.user.name || 'Anonymous'}</p>
              <p className="text-xs text-[var(--text-secondary)]">
                {m.user.email} — {m.user.groupMemberships.length} group{m.user.groupMemberships.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <MemberActions
            userId={m.userId}
            role={m.role}
            isOwner={defaultGroup.ownerId === m.userId}
          />
        </div>
      ))}
    </div>
  )
}
