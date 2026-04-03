import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { EventCard } from '@/components/events/event-card'
import { MemberList } from '@/components/groups/member-list'
import { joinGroup, leaveGroup } from '@/lib/actions/groups'
import { isGroupAdmin } from '@/lib/permissions'
import { SubmitButton } from '@/components/ui/submit-button'

type Props = {
  params: Promise<{ id: string }>
}

export default async function GroupDetailPage({ params }: Props) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const [group, adminStatus] = await Promise.all([
    prisma.group.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
      },
    }),
    isGroupAdmin(session.user.id, id),
  ])
  if (!group) notFound()

  const membership = group.members.find((m) => m.userId === session.user.id)
  const isMember = !!membership

  const now = new Date()
  const events = isMember
    ? await prisma.event.findMany({
        where: { groupId: id, dateTime: { gte: now } },
        include: {
          rsvps: {
            include: { user: { select: { id: true, name: true, image: true } } },
          },
        },
        orderBy: { dateTime: 'asc' },
      })
    : []

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/groups"
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          &larr; All groups
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">{group.name}</h2>
            {group.isDefault && (
              <span className="rounded-full bg-[var(--brand-accent)]/20 px-2 py-0.5 text-xs font-medium text-[var(--brand-accent)]">
                Main
              </span>
            )}
          </div>
          {group.description && (
            <p className="mt-1 text-[var(--text-secondary)]">{group.description}</p>
          )}
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {group.members.length} member{group.members.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex gap-2">
          {!isMember && (
            <form action={async () => { 'use server'; await joinGroup(id) }}>
              <SubmitButton
                className="rounded-lg bg-[var(--brand-accent)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                pendingText="Joining..."
              >
                Join
              </SubmitButton>
            </form>
          )}
          {isMember && !group.isDefault && group.ownerId !== session.user.id && (
            <form action={async () => { 'use server'; await leaveGroup(id) }}>
              <SubmitButton
                className="rounded-lg bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                pendingText="Leaving..."
              >
                Leave
              </SubmitButton>
            </form>
          )}
          {adminStatus && !group.isDefault && (
            <Link
              href={`/groups/${id}/settings`}
              className="rounded-lg bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              Settings
            </Link>
          )}
        </div>
      </div>

      {/* Events */}
      {isMember && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--text-secondary)]">Upcoming Events</h3>
            <Link
              href={`/events/new?groupId=${id}`}
              className="text-sm text-[var(--brand-accent)] hover:underline"
            >
              New Event
            </Link>
          </div>
          {events.length > 0 ? (
            <div className="space-y-3">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  event={{
                    ...event,
                    estimatedCost: event.estimatedCost ? Number(event.estimatedCost) : null,
                    rsvps: event.rsvps.map((r) => ({
                      ...r,
                      status: r.status as 'DOWN' | 'MAYBE' | 'NOT_DOWN',
                    })),
                  }}
                  currentUserId={session.user.id}
                />
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-[var(--text-secondary)]">
              No upcoming events in this group.
            </p>
          )}
        </div>
      )}

      {/* Members */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Members</h3>
        <MemberList
          groupId={id}
          ownerId={group.ownerId}
          members={group.members.map((m) => ({
            userId: m.userId,
            role: m.role as 'MEMBER' | 'ADMIN',
            user: m.user,
          }))}
          currentUserId={session.user.id}
          isAdmin={adminStatus}
          isDefault={group.isDefault}
        />
      </div>
    </div>
  )
}
