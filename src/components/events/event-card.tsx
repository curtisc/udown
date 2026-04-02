import Link from 'next/link'
import { formatEventDate, formatEventTime, formatCost, formatAttendeeCounts } from '@/lib/format'
import { AttendeeList } from './attendee-list'

type EventCardProps = {
  event: {
    id: string
    title: string
    dateTime: Date
    endTime: Date | null
    placeName: string | null
    estimatedCost: number | null
    capacity: number | null
    rsvps: Array<{
      user: { id: string; name: string | null; image: string | null }
      status: 'DOWN' | 'MAYBE' | 'NOT_DOWN'
      guestCount: number
    }>
  }
  currentUserId: string
}

export function EventCard({ event, currentUserId }: EventCardProps) {
  const counts = formatAttendeeCounts(event.rsvps)
  const cost = formatCost(event.estimatedCost)
  const userRsvp = event.rsvps.find((r) => r.user.id === currentUserId)

  return (
    <Link
      href={`/events/${event.id}`}
      className="block rounded-xl bg-[var(--bg-card)] p-4 transition-colors hover:bg-[var(--bg-surface)]"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-[var(--text-primary)] truncate">
            {event.title}
          </h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {formatEventDate(event.dateTime)} at {formatEventTime(event.dateTime)}
            {event.endTime && ` - ${formatEventTime(event.endTime)}`}
          </p>
          {event.placeName && (
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
              {event.placeName}
            </p>
          )}
        </div>
        <div className="ml-3 flex flex-col items-end gap-1">
          {cost && (
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              {cost}/person
            </span>
          )}
          {userRsvp && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                userRsvp.status === 'DOWN'
                  ? 'bg-green-500/20 text-green-400'
                  : userRsvp.status === 'MAYBE'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-red-500/20 text-red-400'
              }`}
            >
              {userRsvp.status === 'DOWN'
                ? "I'm Down"
                : userRsvp.status === 'MAYBE'
                  ? 'Maybe'
                  : "Can't Make It"}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <AttendeeList rsvps={event.rsvps} compact />
        <div className="flex gap-2 text-xs text-[var(--text-secondary)]">
          {counts.down > 0 && <span>{counts.down} down</span>}
          {counts.maybe > 0 && <span>{counts.maybe} maybe</span>}
          {event.capacity && (
            <span>/ {event.capacity} max</span>
          )}
        </div>
      </div>
    </Link>
  )
}
