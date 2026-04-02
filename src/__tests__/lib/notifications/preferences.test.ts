import { describe, it, expect } from 'vitest'
import { filterNotifiableUsers } from '@/lib/notifications/preferences'

type UserPref = {
  userId: string
  email: string
  emailNotifications: boolean
  pref: { newEvents: boolean; eventUpdates: boolean; eventReminders: boolean; rsvpMilestones: boolean } | null
}

describe('filterNotifiableUsers', () => {
  const users: UserPref[] = [
    {
      userId: '1', email: 'a@test.com', emailNotifications: true,
      pref: { newEvents: true, eventUpdates: true, eventReminders: true, rsvpMilestones: true },
    },
    {
      userId: '2', email: 'b@test.com', emailNotifications: true,
      pref: { newEvents: false, eventUpdates: true, eventReminders: true, rsvpMilestones: true },
    },
    {
      userId: '3', email: 'c@test.com', emailNotifications: false,
      pref: { newEvents: true, eventUpdates: true, eventReminders: true, rsvpMilestones: true },
    },
    {
      userId: '4', email: 'd@test.com', emailNotifications: true,
      pref: null,
    },
  ]

  it('filters by global email enabled AND per-group newEvents', () => {
    const result = filterNotifiableUsers(users, 'newEvents')
    expect(result.map((u) => u.userId)).toEqual(['1', '4'])
  })

  it('filters by eventUpdates', () => {
    const result = filterNotifiableUsers(users, 'eventUpdates')
    expect(result.map((u) => u.userId)).toEqual(['1', '2', '4'])
  })

  it('excludes users with global email off regardless of per-group pref', () => {
    const result = filterNotifiableUsers(users, 'eventReminders')
    expect(result.map((u) => u.userId)).not.toContain('3')
  })

  it('treats missing prefs as all-true (defaults)', () => {
    const result = filterNotifiableUsers(users, 'rsvpMilestones')
    expect(result.map((u) => u.userId)).toContain('4')
  })
})
