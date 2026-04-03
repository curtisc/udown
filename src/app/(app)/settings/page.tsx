import { auth, signOut } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { SettingsToggles } from './settings-toggles'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const [user, groups, prefs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        image: true,
        emailNotifications: true,
      },
    }),
    prisma.groupMember.findMany({
      where: { userId: session.user.id },
      include: {
        group: { select: { id: true, name: true } },
      },
    }),
    prisma.notificationPreference.findMany({
      where: { userId: session.user.id },
    }),
  ])
  if (!user) redirect('/sign-in')

  const groupPrefs = groups.map((g) => {
    const pref = prefs.find((p) => p.groupId === g.group.id)
    return {
      groupId: g.group.id,
      groupName: g.group.name,
      newEvents: pref?.newEvents ?? true,
      eventUpdates: pref?.eventUpdates ?? true,
      eventReminders: pref?.eventReminders ?? true,
      rsvpMilestones: pref?.rsvpMilestones ?? true,
    }
  })

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold text-[var(--text-primary)]">Settings</h2>

      <div className="rounded-xl bg-[var(--bg-card)] p-4">
        <h3 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Profile</h3>
        <div className="flex items-center gap-3">
          {user.image ? (
            <img src={user.image} alt={user.name || ''} className="h-12 w-12 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-lg font-bold text-white">
              {(user.name || '?')[0].toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-medium text-[var(--text-primary)]">{user.name || 'Anonymous'}</p>
            <p className="text-sm text-[var(--text-secondary)]">{user.email}</p>
          </div>
        </div>
      </div>

      <SettingsToggles
        emailNotifications={user.emailNotifications}
        groupPrefs={groupPrefs}
      />

      <div className="rounded-xl bg-[var(--bg-card)] p-4">
        <h3 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Account</h3>
        <form action={async () => { 'use server'; await signOut({ redirectTo: '/sign-in' }) }}>
          <button type="submit" className="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30">
            Sign Out
          </button>
        </form>
      </div>
    </div>
  )
}
