import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { formatEventDate, formatEventTime, formatCost } from '@/lib/format'
import { RsvpButton } from '@/components/events/rsvp-button'
import { AttendeeList } from '@/components/events/attendee-list'
import { DeleteEventButton } from '@/components/events/delete-event-button'

type Props = {
  params: Promise<{ id: string }>
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
      rsvps: {
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
      },
      tags: { include: { tag: true } },
    },
  })

  if (!event) notFound()

  const userRsvp = event.rsvps.find((r) => r.user.id === session.user.id)
  const isCreator = event.createdById === session.user.id

  // Check if user is org admin
  const defaultGroup = await prisma.group.findFirst({ where: { isDefault: true } })
  let isOrgAdmin = false
  if (defaultGroup) {
    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: session.user.id, groupId: defaultGroup.id } },
    })
    isOrgAdmin = membership?.role === 'ADMIN'
  }
  const canEdit = isCreator || isOrgAdmin

  const cost = formatCost(event.estimatedCost ? Number(event.estimatedCost) : null)

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/feed"
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          &larr; Back to feed
        </Link>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">{event.title}</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Posted by {event.createdBy.name || 'Anonymous'}
        </p>
      </div>

      <div className="space-y-2 rounded-xl bg-[var(--bg-card)] p-4">
        <div className="flex items-center gap-2 text-[var(--text-primary)]">
          <span className="text-sm font-medium">
            {formatEventDate(event.dateTime)} at {formatEventTime(event.dateTime)}
            {event.endTime && ` - ${formatEventTime(event.endTime)}`}
          </span>
        </div>
        {event.placeName && (
          <p className="text-sm text-[var(--text-secondary)]">
            {event.placeName}
            {event.placeAddress && ` — ${event.placeAddress}`}
          </p>
        )}
        {cost && (
          <p className="text-sm text-[var(--text-secondary)]">
            ~{cost}/person
          </p>
        )}
        {event.capacity && (
          <p className="text-sm text-[var(--text-secondary)]">
            Max {event.capacity} people
          </p>
        )}
      </div>

      {event.description && (
        <p className="whitespace-pre-wrap text-[var(--text-primary)]">
          {event.description}
        </p>
      )}

      {event.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {event.tags.map((et) => (
            <span key={et.tag.id} className="rounded-full bg-[var(--bg-surface)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
              {et.tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="rounded-xl bg-[var(--bg-card)] p-4">
        <RsvpButton
          eventId={event.id}
          currentStatus={userRsvp?.status as 'DOWN' | 'MAYBE' | 'NOT_DOWN' | null ?? null}
          currentGuestCount={userRsvp?.guestCount ?? 0}
        />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Who&apos;s coming?</h3>
        <AttendeeList
          rsvps={event.rsvps.map((r) => ({
            ...r,
            status: r.status as 'DOWN' | 'MAYBE' | 'NOT_DOWN',
          }))}
        />
      </div>

      {canEdit && (
        <div className="flex gap-3 border-t border-[var(--bg-surface)] pt-4">
          <Link
            href={`/events/${event.id}/edit`}
            className="rounded-lg bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-card)]"
          >
            Edit
          </Link>
          <DeleteEventButton eventId={event.id} seriesId={event.seriesId} />
        </div>
      )}
    </div>
  )
}
