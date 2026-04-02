'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function toggleEmailNotifications() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailNotifications: true },
  })
  if (!user) throw new Error('User not found')

  await prisma.user.update({
    where: { id: session.user.id },
    data: { emailNotifications: !user.emailNotifications },
  })

  revalidatePath('/settings')
}

export async function updateGroupNotificationPref(
  groupId: string,
  field: 'newEvents' | 'eventUpdates' | 'eventReminders' | 'rsvpMilestones',
  value: boolean
) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  await prisma.notificationPreference.upsert({
    where: {
      userId_groupId: { userId: session.user.id, groupId },
    },
    create: {
      userId: session.user.id,
      groupId,
      [field]: value,
    },
    update: {
      [field]: value,
    },
  })

  revalidatePath('/settings')
}
