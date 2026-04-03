import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { GroupCard } from '@/components/groups/group-card'
import Link from 'next/link'

export default async function GroupsPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const [groups, userMemberships] = await Promise.all([
    prisma.group.findMany({
      include: {
        _count: { select: { members: true, events: true } },
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    }),
    prisma.groupMember.findMany({
      where: { userId: session.user.id },
      select: { groupId: true },
    }),
  ])
  const memberGroupIds = new Set(userMemberships.map((m) => m.groupId))

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Groups</h2>
        <Link
          href="/groups/new"
          className="rounded-lg bg-[var(--brand-accent)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          New Group
        </Link>
      </div>

      <div className="space-y-3">
        {groups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            isMember={memberGroupIds.has(group.id)}
          />
        ))}
      </div>
    </div>
  )
}
