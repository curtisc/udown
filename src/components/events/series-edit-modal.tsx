'use client'

import { useState, useTransition } from 'react'
import { deleteSeriesEvent } from '@/lib/actions/series'

type Props = {
  eventId: string
  action: 'delete'
  onClose: () => void
}

export function SeriesActionModal({ eventId, action, onClose }: Props) {
  const [scope, setScope] = useState<'this' | 'future' | 'all'>('this')
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      if (action === 'delete') {
        await deleteSeriesEvent(eventId, scope)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl bg-[var(--bg-card)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-bold text-[var(--text-primary)]">
          Delete recurring event
        </h3>

        <div className="space-y-2">
          {(['this', 'future', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`w-full rounded-lg px-4 py-3 text-left text-sm transition-colors ${
                scope === s
                  ? 'bg-[var(--brand-accent)] text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-primary)]'
              }`}
            >
              {s === 'this' && 'This event only'}
              {s === 'future' && 'This and future events'}
              {s === 'all' && 'All events in series'}
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
