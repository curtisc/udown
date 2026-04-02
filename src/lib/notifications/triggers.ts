import { prisma } from '@/lib/prisma'
import { getOrgSettings } from '@/lib/org-settings'
import { sendEmail } from './send-email'
import {
  baseEmailHtml,
  newEventEmailContent,
  eventUpdateEmailContent,
  eventReminderEmailContent,
  rsvpMilestoneEmailContent,
} from './templates'
import {
  filterNotifiableUsers,
  getGroupMembersWithPrefs,
  getRsvpdUsersWithPrefs,
} from './preferences'

function getEventUrl(eventId: string): string {
  const base = process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
  return `${base}/events/${eventId}`
}

export async function notifyNewEvent(eventId: string): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      createdBy: { select: { name: true, email: true } },
      group: { select: { id: true, owner: { select: { email: true } } } },
    },
  })
  if (!event) return

  const org = await getOrgSettings()
  const users = await getGroupMembersWithPrefs(event.groupId, event.createdById)
  const notifiable = filterNotifiableUsers(users, 'newEvents')
  if (notifiable.length === 0) return

  const { subject, content } = newEventEmailContent({
    title: event.title,
    dateTime: event.dateTime,
    placeName: event.placeName,
    estimatedCost: event.estimatedCost ? Number(event.estimatedCost) : null,
    eventUrl: getEventUrl(eventId),
    creatorName: event.createdBy.name || 'Someone',
  })

  const html = baseEmailHtml({ ...org, preheader: subject, content })

  await sendEmail({
    to: notifiable.map((u) => u.email),
    subject,
    html,
    replyTo: event.group.owner.email,
  })
}

export async function notifyEventUpdate(
  eventId: string,
  changes: string[]
): Promise<void> {
  if (changes.length === 0) return

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      group: { select: { id: true, owner: { select: { email: true } } } },
    },
  })
  if (!event) return

  const org = await getOrgSettings()
  const users = await getRsvpdUsersWithPrefs(eventId, event.groupId, ['DOWN', 'MAYBE'])
  const notifiable = filterNotifiableUsers(users, 'eventUpdates')
  if (notifiable.length === 0) return

  const { subject, content } = eventUpdateEmailContent({
    title: event.title,
    changes,
    eventUrl: getEventUrl(eventId),
  })

  const html = baseEmailHtml({ ...org, preheader: subject, content })

  await sendEmail({
    to: notifiable.map((u) => u.email),
    subject,
    html,
    replyTo: event.group.owner.email,
  })
}

export async function notifyRsvpMilestone(eventId: string): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      group: { select: { id: true } },
      rsvps: { where: { status: 'DOWN' }, select: { guestCount: true } },
    },
  })
  if (!event) return

  const totalDown = event.rsvps.reduce((sum, r) => sum + 1 + r.guestCount, 0)
  const milestones = [5, 10, 15, 20, 25, 50]
  const hitMilestone = milestones.find((m) => totalDown === m)
  if (!hitMilestone) return

  const org = await getOrgSettings()
  const users = await getGroupMembersWithPrefs(event.groupId)
  const notifiable = filterNotifiableUsers(users, 'rsvpMilestones')
  if (notifiable.length === 0) return

  const { subject, content } = rsvpMilestoneEmailContent({
    title: event.title,
    count: hitMilestone,
    eventUrl: getEventUrl(eventId),
  })

  const html = baseEmailHtml({ ...org, preheader: subject, content })

  await sendEmail({
    to: notifiable.map((u) => u.email),
    subject,
    html,
  })
}

export async function sendEventReminders(): Promise<number> {
  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000)

  const events = await prisma.event.findMany({
    where: {
      dateTime: { gte: in24h, lt: in25h },
      reminderSentAt: null,
    },
    include: {
      group: { select: { id: true } },
    },
  })

  let sentCount = 0

  for (const event of events) {
    const users = await getRsvpdUsersWithPrefs(event.id, event.groupId, ['DOWN'])
    const notifiable = filterNotifiableUsers(users, 'eventReminders')

    if (notifiable.length > 0) {
      const org = await getOrgSettings()
      const { subject, content } = eventReminderEmailContent({
        title: event.title,
        dateTime: event.dateTime,
        placeName: event.placeName,
        eventUrl: getEventUrl(event.id),
      })
      const html = baseEmailHtml({ ...org, preheader: subject, content })

      await sendEmail({
        to: notifiable.map((u) => u.email),
        subject,
        html,
      })
      sentCount++
    }

    await prisma.event.update({
      where: { id: event.id },
      data: { reminderSentAt: now },
    })
  }

  return sentCount
}
