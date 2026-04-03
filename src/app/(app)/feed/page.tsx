import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { EventCard } from '@/components/events/event-card'
import { WhatsNewBanner } from '@/components/events/whats-new-banner'
import Link from 'next/link'

type Props = {
  searchParams: Promise<{ tag?: string }>
}

export default async function FeedPage({ searchParams }: Props) {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const { tag } = await searchParams
  const now = new Date()

  // Get user's lastVisitedAt for "what's new" banner
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { lastVisitedAt: true },
  })
  const lastVisited = user?.lastVisitedAt

  // Fetch everything in parallel
  const [allTags, upcomingEvents, newGroups, newEvents] = await Promise.all([
    prisma.tag.findMany({ orderBy: { name: 'asc' } }),
    prisma.event.findMany({
      where: {
        dateTime: { gte: now },
        group: {
          members: { some: { userId: session.user.id } },
        },
        ...(tag ? { tags: { some: { tag: { slug: tag } } } } : {}),
      },
      include: {
        rsvps: {
          include: {
            user: { select: { id: true, name: true, image: true } },
          },
        },
      },
      orderBy: { dateTime: 'asc' },
    }),
    // New groups since last visit (that user hasn't joined)
    lastVisited
      ? prisma.group.findMany({
          where: {
            createdAt: { gt: lastVisited },
            isDefault: false,
            ownerId: { not: session.user.id },
            members: { none: { userId: session.user.id } },
          },
          include: { _count: { select: { members: true } } },
          orderBy: { createdAt: 'desc' },
          take: 5,
        })
      : Promise.resolve([]),
    // New events since last visit (in user's groups)
    lastVisited
      ? prisma.event.findMany({
          where: {
            createdAt: { gt: lastVisited },
            createdById: { not: session.user.id },
            dateTime: { gte: now },
            group: {
              members: { some: { userId: session.user.id } },
            },
          },
          include: {
            group: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        })
      : Promise.resolve([]),
  ])

  // Update lastVisitedAt (fire-and-forget, don't block render)
  void prisma.user.update({
    where: { id: session.user.id },
    data: { lastVisitedAt: now },
  }).catch(console.error)

  return (
    <div>
      <WhatsNewBanner newGroups={newGroups} newEvents={newEvents} />

      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Upcoming</h2>
        <Link
          href="/events/new"
          className="rounded-lg bg-[var(--brand-accent)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          New Event
        </Link>
      </div>

      {allTags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href="/feed"
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !tag
                ? 'bg-[var(--brand-accent)] text-white'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
            }`}
          >
            All
          </Link>
          {allTags.map((t) => (
            <Link
              key={t.id}
              href={`/feed?tag=${t.slug}`}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                tag === t.slug
                  ? 'bg-[var(--brand-accent)] text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
              }`}
            >
              {t.name}
            </Link>
          ))}
        </div>
      )}

      {upcomingEvents.length > 0 ? (
        <div className="space-y-3">
          {upcomingEvents.map((event) => (
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
        <div className="py-12 text-center">
          <h3 className="text-lg font-medium text-[var(--text-primary)]">
            No events yet
          </h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Be the first to post one!
          </p>
          <Link
            href="/events/new"
            className="mt-4 inline-block rounded-lg bg-[var(--brand-accent)] px-6 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Create an Event
          </Link>
        </div>
      )}
    </div>
  )
}
