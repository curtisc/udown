'use client'

import { useTransition, useState } from 'react'
import { setRsvp, removeRsvp, updateGuestCount } from '@/lib/actions/rsvps'

type RsvpButtonProps = {
  eventId: string
  currentStatus: 'DOWN' | 'MAYBE' | 'NOT_DOWN' | null
  currentGuestCount: number
}

const statuses = [
  { value: 'DOWN' as const, label: "I'm Down", activeClass: 'bg-green-500 text-white' },
  { value: 'MAYBE' as const, label: 'Maybe', activeClass: 'bg-yellow-500 text-white' },
  { value: 'NOT_DOWN' as const, label: "Can't Make It", activeClass: 'bg-red-500/80 text-white' },
]

export function RsvpButton({ eventId, currentStatus, currentGuestCount }: RsvpButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [guestCount, setGuestCount] = useState(currentGuestCount)

  function handleStatusClick(status: 'DOWN' | 'MAYBE' | 'NOT_DOWN') {
    startTransition(async () => {
      if (status === currentStatus) {
        await removeRsvp(eventId)
      } else {
        await setRsvp(eventId, status, status === 'NOT_DOWN' ? 0 : guestCount)
      }
    })
  }

  function handleGuestChange(delta: number) {
    const newCount = Math.max(0, guestCount + delta)
    setGuestCount(newCount)
    if (currentStatus && currentStatus !== 'NOT_DOWN') {
      startTransition(async () => {
        await updateGuestCount(eventId, newCount)
      })
    }
  }

  const showGuestPicker = currentStatus === 'DOWN' || currentStatus === 'MAYBE'

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {statuses.map((s) => (
          <button
            key={s.value}
            onClick={() => handleStatusClick(s.value)}
            disabled={isPending}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              currentStatus === s.value
                ? s.activeClass
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            } ${isPending ? 'opacity-50' : ''}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {showGuestPicker && (
        <div className="flex items-center gap-3 rounded-lg bg-[var(--bg-surface)] px-3 py-2">
          <span className="text-sm text-[var(--text-secondary)]">Bringing anyone?</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleGuestChange(-1)}
              disabled={isPending || guestCount === 0}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-card)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-primary)] disabled:opacity-30"
            >
              -
            </button>
            <span className="w-6 text-center text-sm font-medium text-[var(--text-primary)]">
              {guestCount}
            </span>
            <button
              onClick={() => handleGuestChange(1)}
              disabled={isPending}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-card)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-primary)]"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
