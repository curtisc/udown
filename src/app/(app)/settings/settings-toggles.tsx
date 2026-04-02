'use client'

import { useTransition } from 'react'
import { toggleEmailNotifications, updateGroupNotificationPref } from '@/lib/actions/settings'

type GroupPref = {
  groupId: string
  groupName: string
  newEvents: boolean
  eventUpdates: boolean
  eventReminders: boolean
  rsvpMilestones: boolean
}

type Props = {
  emailNotifications: boolean
  groupPrefs: GroupPref[]
}

export function SettingsToggles({ emailNotifications, groupPrefs }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleGlobalToggle() {
    startTransition(async () => {
      await toggleEmailNotifications()
    })
  }

  function handleGroupToggle(
    groupId: string,
    field: 'newEvents' | 'eventUpdates' | 'eventReminders' | 'rsvpMilestones',
    currentValue: boolean
  ) {
    startTransition(async () => {
      await updateGroupNotificationPref(groupId, field, !currentValue)
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-[var(--bg-card)] p-4">
        <h3 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">
          Email Notifications
        </h3>
        <Toggle
          label="Receive email notifications"
          checked={emailNotifications}
          onChange={handleGlobalToggle}
          disabled={isPending}
        />
      </div>

      {emailNotifications && groupPrefs.map((gp) => (
        <div key={gp.groupId} className="rounded-xl bg-[var(--bg-card)] p-4">
          <h3 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">
            {gp.groupName}
          </h3>
          <div className="space-y-3">
            <Toggle
              label="New events"
              checked={gp.newEvents}
              onChange={() => handleGroupToggle(gp.groupId, 'newEvents', gp.newEvents)}
              disabled={isPending}
            />
            <Toggle
              label="Event updates"
              checked={gp.eventUpdates}
              onChange={() => handleGroupToggle(gp.groupId, 'eventUpdates', gp.eventUpdates)}
              disabled={isPending}
            />
            <Toggle
              label="Event reminders (24hr before)"
              checked={gp.eventReminders}
              onChange={() => handleGroupToggle(gp.groupId, 'eventReminders', gp.eventReminders)}
              disabled={isPending}
            />
            <Toggle
              label="RSVP milestones"
              checked={gp.rsvpMilestones}
              onChange={() => handleGroupToggle(gp.groupId, 'rsvpMilestones', gp.rsvpMilestones)}
              disabled={isPending}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: () => void
  disabled: boolean
}) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-[var(--bg-surface)] ${disabled ? 'opacity-50' : ''}`}
    >
      <span className="text-sm text-[var(--text-primary)]">{label}</span>
      <div
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? 'bg-[var(--brand-accent)]' : 'bg-[var(--bg-surface)]'
        }`}
      >
        <div
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </div>
    </button>
  )
}
