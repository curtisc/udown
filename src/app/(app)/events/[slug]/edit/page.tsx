import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { EventForm } from '@/components/events/event-form'
import { updateEvent } from '@/lib/actions/events'
import { getTags } from '@/lib/actions/tags'

type Props = {
  params: Promise<{ slug: string }>
}

export default async function EditEventPage({ params }: Props) {
  const { slug } = await params
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const [event, tags, memberships] = await Promise.all([
    prisma.event.findUnique({
      where: { slug },
      include: { tags: { select: { tagId: true } } },
    }),
    getTags(),
    prisma.groupMember.findMany({
      where: { userId: session.user.id },
      include: { group: { select: { id: true, name: true } } },
      orderBy: { group: { isDefault: 'desc' } },
    }),
  ])

  if (!event) notFound()

  // Check permissions: creator or org admin
  let canEdit = event.createdById === session.user.id
  if (!canEdit) {
    const defaultGroup = await prisma.group.findFirst({ where: { isDefault: true } })
    if (defaultGroup) {
      const membership = await prisma.groupMember.findUnique({
        where: { userId_groupId: { userId: session.user.id, groupId: defaultGroup.id } },
      })
      canEdit = membership?.role === 'ADMIN'
    }
  }
  if (!canEdit) redirect(`/events/${slug}`)

  const boundUpdateEvent = updateEvent.bind(null, event.id)
  const groups = memberships.map((m) => m.group)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Edit Event</h2>
        <Link
          href={`/events/${event.slug}`}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Cancel
        </Link>
      </div>
      <EventForm
        action={boundUpdateEvent}
        submitLabel="Save Changes"
        groups={groups}
        availableTags={tags}
        defaultValues={{
          title: event.title,
          description: event.description,
          dateTime: event.dateTime.toISOString(),
          endTime: event.endTime ? event.endTime.toISOString() : null,
          placeName: event.placeName,
          placeAddress: event.placeAddress,
          estimatedCost: event.estimatedCost ? Number(event.estimatedCost) : null,
          capacity: event.capacity,
          tagIds: event.tags.map((t) => t.tagId),
        }}
      />
    </div>
  )
}
