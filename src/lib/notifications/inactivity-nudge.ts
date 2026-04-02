import { prisma } from '@/lib/prisma'
import { getOrgSettings } from '@/lib/org-settings'
import { sendEmail } from './send-email'
import { baseEmailHtml } from './templates'

export async function sendInactivityNudges(): Promise<number> {
  const now = new Date()
  let nudgeCount = 0

  const groups = await prisma.group.findMany({
    where: {
      isDefault: false, // Don't nudge for the default group
    },
    include: {
      members: {
        where: { role: 'ADMIN' },
        include: {
          user: { select: { email: true, emailNotifications: true } },
        },
      },
    },
  })

  for (const group of groups) {
    const daysSinceEvent = group.lastEventAt
      ? Math.floor((now.getTime() - group.lastEventAt.getTime()) / (1000 * 60 * 60 * 24))
      : null

    // Skip if not inactive
    if (daysSinceEvent === null || daysSinceEvent < group.inactivityThresholdDays) continue

    // Skip if we already nudged recently (within the threshold period)
    if (group.lastNudgeSentAt) {
      const daysSinceNudge = Math.floor(
        (now.getTime() - group.lastNudgeSentAt.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysSinceNudge < group.inactivityThresholdDays) continue
    }

    const admins = group.members.filter((m) => m.user.emailNotifications)
    if (admins.length === 0) continue

    const org = await getOrgSettings()
    const textPrimary = '#f1f5f9'
    const accentColor = '#16a0ac'
    const base = process.env.AUTH_URL || 'http://localhost:3000'

    const subject = `${group.name} hasn't had an event in ${daysSinceEvent} days`
    const content = `
      <h2 style="margin:0 0 12px;font-size:20px;color:${textPrimary};">
        ${group.name} has been quiet
      </h2>
      <p style="margin:0 0 20px;font-size:14px;color:${textPrimary};">
        It's been ${daysSinceEvent} days since the last event. Maybe it's time for something new?
      </p>
      <a href="${base}/events/new?groupId=${group.id}" style="display:inline-block;background-color:${accentColor};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        Create an Event
      </a>
    `

    const html = baseEmailHtml({ ...org, preheader: subject, content })

    await sendEmail({
      to: admins.map((a) => a.user.email),
      subject,
      html,
    })

    await prisma.group.update({
      where: { id: group.id },
      data: { lastNudgeSentAt: now },
    })

    nudgeCount++
  }

  return nudgeCount
}
