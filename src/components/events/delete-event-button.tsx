'use client'

import { useState, useTransition } from 'react'
import { deleteEvent } from '@/lib/actions/events'
import { SeriesActionModal } from './series-edit-modal'

type Props = {
  eventId: string
  seriesId: string | null
}

export function DeleteEventButton({ eventId, seriesId }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (seriesId) {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30"
        >
          Delete
        </button>
        {showModal && (
          <SeriesActionModal
            eventId={eventId}
            action="delete"
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    )
  }

  return (
    <button
      onClick={() => startTransition(() => deleteEvent(eventId))}
      disabled={isPending}
      className="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30 disabled:opacity-50"
    >
      {isPending ? 'Deleting...' : 'Delete'}
    </button>
  )
}
