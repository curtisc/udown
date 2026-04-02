type Attendee = {
  user: {
    id: string
    name: string | null
    image: string | null
  }
  status: 'DOWN' | 'MAYBE' | 'NOT_DOWN'
  guestCount: number
}

type AttendeeListProps = {
  rsvps: Attendee[]
  compact?: boolean
}

export function AttendeeList({ rsvps, compact = false }: AttendeeListProps) {
  const down = rsvps.filter((r) => r.status === 'DOWN')
  const maybe = rsvps.filter((r) => r.status === 'MAYBE')

  if (compact) {
    return <AvatarRow rsvps={[...down, ...maybe]} />
  }

  return (
    <div className="space-y-4">
      {down.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-[var(--text-secondary)]">
            Down ({down.reduce((sum, r) => sum + 1 + r.guestCount, 0)})
          </h4>
          <div className="space-y-2">
            {down.map((r) => (
              <AttendeeRow key={r.user.id} attendee={r} />
            ))}
          </div>
        </div>
      )}
      {maybe.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-[var(--text-secondary)]">
            Maybe ({maybe.reduce((sum, r) => sum + 1 + r.guestCount, 0)})
          </h4>
          <div className="space-y-2">
            {maybe.map((r) => (
              <AttendeeRow key={r.user.id} attendee={r} />
            ))}
          </div>
        </div>
      )}
      {down.length === 0 && maybe.length === 0 && (
        <p className="text-sm text-[var(--text-secondary)]">No one has responded yet.</p>
      )}
    </div>
  )
}

function AttendeeRow({ attendee }: { attendee: Attendee }) {
  return (
    <div className="flex items-center gap-2">
      {attendee.user.image ? (
        <img
          src={attendee.user.image}
          alt={attendee.user.name || ''}
          className="h-7 w-7 rounded-full"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-surface)] text-xs font-bold text-[var(--text-secondary)]">
          {(attendee.user.name || '?')[0].toUpperCase()}
        </div>
      )}
      <span className="text-sm text-[var(--text-primary)]">
        {attendee.user.name || 'Anonymous'}
      </span>
      {attendee.guestCount > 0 && (
        <span className="text-xs text-[var(--text-secondary)]">
          +{attendee.guestCount}
        </span>
      )}
    </div>
  )
}

function AvatarRow({ rsvps }: { rsvps: Attendee[] }) {
  const shown = rsvps.slice(0, 5)
  const remaining = rsvps.length - shown.length

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((r) =>
          r.user.image ? (
            <img
              key={r.user.id}
              src={r.user.image}
              alt={r.user.name || ''}
              className="h-7 w-7 rounded-full border-2 border-[var(--bg-card)]"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              key={r.user.id}
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--bg-card)] bg-[var(--bg-surface)] text-xs font-bold text-[var(--text-secondary)]"
            >
              {(r.user.name || '?')[0].toUpperCase()}
            </div>
          )
        )}
      </div>
      {remaining > 0 && (
        <span className="ml-2 text-xs text-[var(--text-secondary)]">
          +{remaining} more
        </span>
      )}
    </div>
  )
}
