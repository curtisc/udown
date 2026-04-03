'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { joinGroup } from '@/lib/actions/groups'

type NewGroup = {
  id: string
  slug: string
  name: string
  description: string | null
  _count: { members: number }
}

type NewEvent = {
  id: string
  slug: string
  title: string
  dateTime: Date
  placeName: string | null
  group: { name: string }
}

type Props = {
  newGroups: NewGroup[]
  newEvents: NewEvent[]
}

export function WhatsNewBanner({ newGroups, newEvents }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [joinedGroupIds, setJoinedGroupIds] = useState<Set<string>>(new Set())

  if (dismissed || (newGroups.length === 0 && newEvents.length === 0)) {
    return null
  }

  function handleJoin(groupId: string) {
    startTransition(async () => {
      await joinGroup(groupId)
      setJoinedGroupIds((prev) => new Set(prev).add(groupId))
    })
  }

  return (
    <div className="mb-6 rounded-xl border border-[var(--brand-accent)]/30 bg-[var(--bg-card)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--brand-accent)]">
          Since you were last here
        </h3>
        <button
          onClick={() => setDismissed(true)}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          aria-label="Dismiss"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {newGroups.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-[var(--text-secondary)] mb-2">
            {newGroups.length} new group{newGroups.length !== 1 ? 's' : ''}
          </p>
          <div className="space-y-2">
            {newGroups.map((group) => (
              <div
                key={group.id}
                className="flex items-center justify-between rounded-lg bg-[var(--bg-surface)] px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/groups/${group.slug}`}
                    className="text-sm font-medium text-[var(--text-primary)] hover:underline"
                  >
                    {group.name}
                  </Link>
                  {group.description && (
                    <p className="text-xs text-[var(--text-secondary)] truncate">
                      {group.description}
                    </p>
                  )}
                </div>
                {joinedGroupIds.has(group.id) ? (
                  <span className="ml-2 shrink-0 text-xs text-green-400">Joined</span>
                ) : (
                  <button
                    onClick={() => handleJoin(group.id)}
                    disabled={isPending}
                    className="ml-2 shrink-0 rounded-lg bg-[var(--brand-accent)] px-3 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    Join
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {newEvents.length > 0 && (
        <div>
          <p className="text-xs text-[var(--text-secondary)] mb-2">
            {newEvents.length} new event{newEvents.length !== 1 ? 's' : ''}
          </p>
          <div className="space-y-2">
            {newEvents.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.slug}`}
                className="flex items-center justify-between rounded-lg bg-[var(--bg-surface)] px-3 py-2 transition-colors hover:bg-[var(--bg-primary)]"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {event.title}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    in {event.group.name}
                    {event.placeName && ` · ${event.placeName}`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
