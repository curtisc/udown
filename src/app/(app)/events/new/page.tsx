import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { createEvent } from '@/lib/actions/events'
import { getTags } from '@/lib/actions/tags'
import { EventForm } from '@/components/events/event-form'
import Link from 'next/link'

type Props = {
  searchParams: Promise<{ groupId?: string }>
}

export default async function NewEventPage({ searchParams }: Props) {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const { groupId } = await searchParams

  const [memberships, tags] = await Promise.all([
    prisma.groupMember.findMany({
      where: { userId: session.user.id },
      include: { group: { select: { id: true, name: true } } },
      orderBy: { group: { isDefault: 'desc' } },
    }),
    getTags(),
  ])

  const groups = memberships.map((m) => m.group)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">New Event</h2>
        <Link
          href="/feed"
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Cancel
        </Link>
      </div>
      <EventForm
        action={createEvent}
        submitLabel="Create Event"
        groups={groups}
        availableTags={tags}
        defaultValues={{ groupId: groupId || undefined }}
      />
    </div>
  )
}
