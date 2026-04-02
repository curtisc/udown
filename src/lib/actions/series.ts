'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { generateEventDates, getWeekOfMonth } from '@/lib/series-utils'
import { logActivity } from '@/lib/activity-log'
import { isGroupAdmin } from '@/lib/permissions'

export async function createEventSeries(formData: FormData) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const groupId = formData.get('groupId') as string
  if (!groupId) throw new Error('Group is required')

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  })
  if (!membership) throw new Error('Not a member of this group')

  const title = (formData.get('title') as string)?.trim()
  if (!title) throw new Error('Title is required')

  const recurrence = formData.get('recurrence') as 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'
  const dateTimeStr = formData.get('dateTime') as string
  if (!dateTimeStr) throw new Error('Date/time is required')

  const startDate = new Date(dateTimeStr)
  const dayOfWeek = startDate.getDay()
  const weekOfMonth = recurrence === 'MONTHLY' ? getWeekOfMonth(startDate) : null
  const timeOfDay = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`

  const endTimeStr = formData.get('endTime') as string
  let durationMinutes: number | null = null
  if (endTimeStr) {
    const endDate = new Date(endTimeStr)
    durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000)
  }

  const endsAtStr = formData.get('seriesEndsAt') as string
  const costStr = formData.get('estimatedCost') as string
  const capacityStr = formData.get('capacity') as string
  const tagIdsStr = formData.get('tagIds') as string

  const series = await prisma.eventSeries.create({
    data: {
      groupId,
      createdById: session.user.id,
      recurrence,
      dayOfWeek,
      weekOfMonth,
      timeOfDay,
      durationMinutes,
      title,
      description: (formData.get('description') as string)?.trim() || null,
      placeName: (formData.get('placeName') as string)?.trim() || null,
      placeAddress: (formData.get('placeAddress') as string)?.trim() || null,
      placeLat: formData.get('placeLat') ? parseFloat(formData.get('placeLat') as string) : null,
      placeLng: formData.get('placeLng') ? parseFloat(formData.get('placeLng') as string) : null,
      placeId: (formData.get('placeId') as string) || null,
      estimatedCost: costStr ? parseFloat(costStr) : null,
      capacity: capacityStr ? parseInt(capacityStr, 10) : null,
      tagIds: tagIdsStr ? JSON.parse(tagIdsStr) : [],
      startsAt: startDate,
      endsAt: endsAtStr ? new Date(endsAtStr) : null,
    },
  })

  // Generate initial instances
  await generateSeriesInstances(series.id, 8)

  await prisma.group.update({
    where: { id: groupId },
    data: { lastEventAt: new Date() },
  })

  logActivity({
    actorId: session.user.id,
    action: 'EVENT_CREATED',
    targetType: 'EVENT',
    targetId: series.id,
    metadata: { eventTitle: title, recurring: recurrence },
  })

  revalidatePath('/feed')
  redirect('/feed')
}

export async function generateSeriesInstances(
  seriesId: string,
  count: number
): Promise<number> {
  const series = await prisma.eventSeries.findUnique({
    where: { id: seriesId },
    include: { events: { select: { dateTime: true }, orderBy: { dateTime: 'desc' }, take: 1 } },
  })
  if (!series) return 0

  // Start generating from after the last existing instance, or from startsAt
  const lastEvent = series.events[0]
  const startFrom = lastEvent
    ? new Date(lastEvent.dateTime.getTime() + 1000) // 1 second after last
    : series.startsAt

  const dates = generateEventDates({
    recurrence: series.recurrence as 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY',
    dayOfWeek: series.dayOfWeek,
    weekOfMonth: series.weekOfMonth ?? undefined,
    timeOfDay: series.timeOfDay,
    startsAt: startFrom,
    endsAt: series.endsAt,
    skippedDates: series.skippedDates,
    count,
  })

  for (const date of dates) {
    const endTime = series.durationMinutes
      ? new Date(date.getTime() + series.durationMinutes * 60000)
      : null

    const newEvent = await prisma.event.create({
      data: {
        title: series.title,
        description: series.description,
        dateTime: date,
        endTime,
        placeName: series.placeName,
        placeAddress: series.placeAddress,
        placeLat: series.placeLat,
        placeLng: series.placeLng,
        placeId: series.placeId,
        estimatedCost: series.estimatedCost,
        capacity: series.capacity,
        groupId: series.groupId,
        createdById: series.createdById,
        seriesId: series.id,
      },
    })

    // Auto-RSVP the series creator as "DOWN"
    await prisma.rSVP.create({
      data: {
        userId: series.createdById,
        eventId: newEvent.id,
        status: 'DOWN',
        guestCount: 0,
      },
    }).catch(() => {}) // Ignore if already exists

    // Create tag associations
    if (series.tagIds.length > 0) {
      for (const tagId of series.tagIds) {
        await prisma.eventTag.create({
          data: { eventId: newEvent.id, tagId },
        }).catch(() => {}) // Ignore if tag doesn't exist
      }
    }
  }

  return dates.length
}

export async function editSeriesEvent(
  eventId: string,
  scope: 'this' | 'future' | 'all',
  formData: FormData
) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { series: true },
  })
  if (!event?.series) throw new Error('Not a series event')

  const canEdit = event.createdById === session.user.id || await isGroupAdmin(session.user.id, event.groupId)
  if (!canEdit) throw new Error('Not authorized')

  if (scope === 'this') {
    // Edit just this instance
    await prisma.event.update({
      where: { id: eventId },
      data: {
        title: (formData.get('title') as string)?.trim() || event.title,
        description: (formData.get('description') as string)?.trim() || null,
        dateTime: formData.get('dateTime') ? new Date(formData.get('dateTime') as string) : event.dateTime,
        endTime: formData.get('endTime') ? new Date(formData.get('endTime') as string) : event.endTime,
        placeName: (formData.get('placeName') as string)?.trim() || null,
        placeAddress: (formData.get('placeAddress') as string)?.trim() || null,
        estimatedCost: formData.get('estimatedCost') ? parseFloat(formData.get('estimatedCost') as string) : null,
        capacity: formData.get('capacity') ? parseInt(formData.get('capacity') as string, 10) : null,
        isModified: true,
      },
    })
  } else {
    // Update the series template
    const title = (formData.get('title') as string)?.trim() || event.series.title
    await prisma.eventSeries.update({
      where: { id: event.series.id },
      data: {
        title,
        description: (formData.get('description') as string)?.trim() || null,
        placeName: (formData.get('placeName') as string)?.trim() || null,
        placeAddress: (formData.get('placeAddress') as string)?.trim() || null,
        estimatedCost: formData.get('estimatedCost') ? parseFloat(formData.get('estimatedCost') as string) : null,
        capacity: formData.get('capacity') ? parseInt(formData.get('capacity') as string, 10) : null,
      },
    })

    // Update future instances
    const where = scope === 'all'
      ? { seriesId: event.series.id, dateTime: { gte: new Date() } }
      : { seriesId: event.series.id, dateTime: { gte: event.dateTime }, isModified: false }

    await prisma.event.updateMany({
      where,
      data: {
        title,
        description: (formData.get('description') as string)?.trim() || null,
        placeName: (formData.get('placeName') as string)?.trim() || null,
        placeAddress: (formData.get('placeAddress') as string)?.trim() || null,
        estimatedCost: formData.get('estimatedCost') ? parseFloat(formData.get('estimatedCost') as string) : null,
        capacity: formData.get('capacity') ? parseInt(formData.get('capacity') as string, 10) : null,
      },
    })
  }

  revalidatePath('/feed')
  revalidatePath(`/events/${eventId}`)
  redirect(`/events/${eventId}`)
}

export async function deleteSeriesEvent(
  eventId: string,
  scope: 'this' | 'future' | 'all'
) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { series: true },
  })
  if (!event?.series) throw new Error('Not a series event')

  const canDelete = event.createdById === session.user.id || await isGroupAdmin(session.user.id, event.groupId)
  if (!canDelete) throw new Error('Not authorized')

  if (scope === 'this') {
    await prisma.event.delete({ where: { id: eventId } })
    await prisma.eventSeries.update({
      where: { id: event.series.id },
      data: { skippedDates: { push: event.dateTime } },
    })
  } else if (scope === 'future') {
    await prisma.event.deleteMany({
      where: { seriesId: event.series.id, dateTime: { gte: event.dateTime } },
    })
    await prisma.eventSeries.update({
      where: { id: event.series.id },
      data: { endsAt: event.dateTime },
    })
  } else {
    // Delete all future instances and the series
    await prisma.event.deleteMany({
      where: { seriesId: event.series.id, dateTime: { gte: new Date() } },
    })
    await prisma.eventSeries.delete({ where: { id: event.series.id } })
  }

  logActivity({
    actorId: session.user.id,
    action: 'EVENT_DELETED',
    targetType: 'EVENT',
    targetId: eventId,
    metadata: { eventTitle: event.title, scope },
  })

  revalidatePath('/feed')
  redirect('/feed')
}
