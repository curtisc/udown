'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { notifyRsvpMilestone } from '@/lib/notifications/triggers'
import { logActivity } from '@/lib/activity-log'

export async function setRsvp(
  eventId: string,
  status: 'DOWN' | 'MAYBE' | 'NOT_DOWN',
  guestCount: number = 0
) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const [currentRsvp, event] = await Promise.all([
    prisma.rSVP.findUnique({ where: { userId_eventId: { userId: session.user.id, eventId } } }),
    prisma.event.findUnique({ where: { id: eventId }, select: { title: true } }),
  ])

  await prisma.rSVP.upsert({
    where: {
      userId_eventId: { userId: session.user.id, eventId },
    },
    create: {
      userId: session.user.id,
      eventId,
      status,
      guestCount: status === 'NOT_DOWN' ? 0 : guestCount,
    },
    update: {
      status,
      guestCount: status === 'NOT_DOWN' ? 0 : guestCount,
    },
  })

  logActivity({
    actorId: session.user.id,
    action: currentRsvp ? 'RSVP_UPDATED' : 'RSVP_CREATED',
    targetType: 'EVENT',
    targetId: eventId,
    metadata: {
      eventTitle: event?.title,
      status,
      previousStatus: currentRsvp?.status || null,
      guestCount,
    },
  })

  if (status === 'DOWN') {
    void notifyRsvpMilestone(eventId).catch(console.error)
  }

  revalidatePath(`/events/${eventId}`)
  revalidatePath('/feed')
}

export async function removeRsvp(eventId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  await prisma.rSVP.deleteMany({
    where: { userId: session.user.id, eventId },
  })

  revalidatePath(`/events/${eventId}`)
  revalidatePath('/feed')
}

export async function updateGuestCount(eventId: string, guestCount: number) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const existing = await prisma.rSVP.findUnique({
    where: { userId_eventId: { userId: session.user.id, eventId } },
  })
  if (!existing) throw new Error('No RSVP found')

  await prisma.rSVP.update({
    where: { userId_eventId: { userId: session.user.id, eventId } },
    data: { guestCount },
  })

  revalidatePath(`/events/${eventId}`)
  revalidatePath('/feed')
}
