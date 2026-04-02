type NotificationType = 'newEvents' | 'eventUpdates' | 'eventReminders' | 'rsvpMilestones'

type UserWithPref = {
  userId: string
  email: string
  emailNotifications: boolean
  pref: {
    newEvents: boolean
    eventUpdates: boolean
    eventReminders: boolean
    rsvpMilestones: boolean
  } | null
}

async function getPrisma() {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

export function filterNotifiableUsers(
  users: UserWithPref[],
  type: NotificationType
): UserWithPref[] {
  return users.filter((u) => {
    if (!u.emailNotifications) return false
    if (!u.pref) return true // no per-group pref = defaults (all true)
    return u.pref[type]
  })
}

export async function getGroupMembersWithPrefs(
  groupId: string,
  excludeUserId?: string
): Promise<UserWithPref[]> {
  const prisma = await getPrisma()

  const members = await prisma.groupMember.findMany({
    where: {
      groupId,
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          emailNotifications: true,
          notificationPrefs: {
            where: { groupId },
            select: {
              newEvents: true,
              eventUpdates: true,
              eventReminders: true,
              rsvpMilestones: true,
            },
          },
        },
      },
    },
  })

  return members.map((m) => ({
    userId: m.user.id,
    email: m.user.email,
    emailNotifications: m.user.emailNotifications,
    pref: m.user.notificationPrefs[0] ?? null,
  }))
}

export async function getRsvpdUsersWithPrefs(
  eventId: string,
  groupId: string,
  statuses: ('DOWN' | 'MAYBE')[]
): Promise<UserWithPref[]> {
  const prisma = await getPrisma()

  const rsvps = await prisma.rSVP.findMany({
    where: {
      eventId,
      status: { in: statuses },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          emailNotifications: true,
          notificationPrefs: {
            where: { groupId },
            select: {
              newEvents: true,
              eventUpdates: true,
              eventReminders: true,
              rsvpMilestones: true,
            },
          },
        },
      },
    },
  })

  return rsvps.map((r) => ({
    userId: r.user.id,
    email: r.user.email,
    emailNotifications: r.user.emailNotifications,
    pref: r.user.notificationPrefs[0] ?? null,
  }))
}
