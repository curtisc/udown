'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { notifyNewEvent, notifyEventUpdate } from '@/lib/notifications/triggers'
import { logActivity } from '@/lib/activity-log'
import { isGroupAdmin } from '@/lib/permissions'

export async function createEvent(formData: FormData) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  // Delegate to series action if recurring
  if (formData.get('isRecurring') === 'true') {
    const { createEventSeries } = await import('@/lib/actions/series')
    return createEventSeries(formData)
  }

  const groupId = formData.get('groupId') as string
  let targetGroupId: string

  if (groupId) {
    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: session.user.id, groupId } },
    })
    if (!membership) throw new Error('Not a member of this group')
    targetGroupId = groupId
  } else {
    const defaultGroup = await prisma.group.findFirst({ where: { isDefault: true } })
    if (!defaultGroup) throw new Error('No default group found')
    targetGroupId = defaultGroup.id
  }

  const title = formData.get('title') as string
  if (!title?.trim()) throw new Error('Title is required')

  const dateTimeStr = formData.get('dateTime') as string
  if (!dateTimeStr) throw new Error('Date and time are required')

  const endTimeStr = formData.get('endTime') as string
  const costStr = formData.get('estimatedCost') as string
  const capacityStr = formData.get('capacity') as string
  const placeLatStr = formData.get('placeLat') as string
  const placeLngStr = formData.get('placeLng') as string

  const event = await prisma.event.create({
    data: {
      title: title.trim(),
      description: (formData.get('description') as string)?.trim() || null,
      dateTime: new Date(dateTimeStr),
      endTime: endTimeStr ? new Date(endTimeStr) : null,
      placeName: (formData.get('placeName') as string)?.trim() || null,
      placeAddress: (formData.get('placeAddress') as string)?.trim() || null,
      placeLat: placeLatStr ? parseFloat(placeLatStr) : null,
      placeLng: placeLngStr ? parseFloat(placeLngStr) : null,
      placeId: (formData.get('placeId') as string) || null,
      estimatedCost: costStr ? parseFloat(costStr) : null,
      capacity: capacityStr ? parseInt(capacityStr, 10) : null,
      groupId: targetGroupId,
      createdById: session.user.id,
    },
  })

  // Handle tags
  const tagIdsStr = formData.get('tagIds') as string
  if (tagIdsStr) {
    let tagIds: string[] = []
    try {
      const parsed = JSON.parse(tagIdsStr)
      if (Array.isArray(parsed)) tagIds = parsed.filter(id => typeof id === 'string')
    } catch {}
    if (tagIds.length > 0) {
      const { setEventTags } = await import('@/lib/actions/tags')
      await setEventTags(event.id, tagIds)
    }
  }

  // Auto-RSVP the creator as "DOWN"
  await prisma.rSVP.create({
    data: {
      userId: session.user.id,
      eventId: event.id,
      status: 'DOWN',
      guestCount: 0,
    },
  })

  await prisma.group.update({
    where: { id: targetGroupId },
    data: { lastEventAt: new Date() },
  })

  logActivity({ actorId: session.user.id, action: 'EVENT_CREATED', targetType: 'EVENT', targetId: event.id, metadata: { eventTitle: event.title } })

  void notifyNewEvent(event.id).catch(console.error)

  revalidatePath('/feed')
  redirect('/feed')
}

export async function updateEvent(eventId: string, formData: FormData) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { group: true },
  })
  if (!event) throw new Error('Event not found')

  const canEdit = await checkEditPermission(session.user.id, event)
  if (!canEdit) throw new Error('Not authorized to edit this event')

  const title = formData.get('title') as string
  if (!title?.trim()) throw new Error('Title is required')

  const dateTimeStr = formData.get('dateTime') as string
  if (!dateTimeStr) throw new Error('Date and time are required')

  const endTimeStr = formData.get('endTime') as string
  const costStr = formData.get('estimatedCost') as string
  const capacityStr = formData.get('capacity') as string
  const placeLatStr = formData.get('placeLat') as string
  const placeLngStr = formData.get('placeLng') as string

  await prisma.event.update({
    where: { id: eventId },
    data: {
      title: title.trim(),
      description: (formData.get('description') as string)?.trim() || null,
      dateTime: new Date(dateTimeStr),
      endTime: endTimeStr ? new Date(endTimeStr) : null,
      placeName: (formData.get('placeName') as string)?.trim() || null,
      placeAddress: (formData.get('placeAddress') as string)?.trim() || null,
      placeLat: placeLatStr ? parseFloat(placeLatStr) : null,
      placeLng: placeLngStr ? parseFloat(placeLngStr) : null,
      placeId: (formData.get('placeId') as string) || null,
      estimatedCost: costStr ? parseFloat(costStr) : null,
      capacity: capacityStr ? parseInt(capacityStr, 10) : null,
    },
  })

  // Handle tags
  const tagIdsStr = formData.get('tagIds') as string
  if (tagIdsStr) {
    let tagIds: string[] = []
    try {
      const parsed = JSON.parse(tagIdsStr)
      if (Array.isArray(parsed)) tagIds = parsed.filter(id => typeof id === 'string')
    } catch {}
    const { setEventTags } = await import('@/lib/actions/tags')
    await setEventTags(eventId, tagIds)
  }

  const changes: string[] = []
  if (title.trim() !== event.title) changes.push('Title changed')
  if (new Date(dateTimeStr).getTime() !== event.dateTime.getTime()) changes.push('Time changed')
  if (((formData.get('placeName') as string)?.trim() || null) !== event.placeName) changes.push('Location changed')

  logActivity({ actorId: session.user.id, action: 'EVENT_UPDATED', targetType: 'EVENT', targetId: eventId, metadata: { eventTitle: title.trim(), changes } })

  if (changes.length > 0) {
    void notifyEventUpdate(eventId, changes).catch(console.error)
  }

  revalidatePath('/feed')
  revalidatePath(`/events/${eventId}`)
  redirect(`/events/${eventId}`)
}

export async function deleteEvent(eventId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const event = await prisma.event.findUnique({
    where: { id: eventId },
  })
  if (!event) throw new Error('Event not found')

  const canEdit = await checkEditPermission(session.user.id, event)
  if (!canEdit) throw new Error('Not authorized to delete this event')

  await prisma.event.delete({ where: { id: eventId } })

  logActivity({ actorId: session.user.id, action: 'EVENT_DELETED', targetType: 'EVENT', targetId: eventId, metadata: { eventTitle: event.title } })

  revalidatePath('/feed')
  redirect('/feed')
}

async function checkEditPermission(
  userId: string,
  event: { createdById: string; groupId: string }
): Promise<boolean> {
  if (event.createdById === userId) return true
  return isGroupAdmin(userId, event.groupId)
}
