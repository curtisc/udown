export function formatEventDate(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function formatEventTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function formatCost(cost: number | null | undefined): string | null {
  if (cost === null || cost === undefined || cost === 0) return null
  if (Number.isInteger(cost)) return `$${cost}`
  return `$${cost.toFixed(2)}`
}

type RsvpForCount = { status: 'DOWN' | 'MAYBE' | 'NOT_DOWN'; guestCount: number }

export function formatAttendeeCounts(rsvps: RsvpForCount[]): {
  down: number
  maybe: number
  notDown: number
} {
  let down = 0
  let maybe = 0
  let notDown = 0

  for (const rsvp of rsvps) {
    const total = 1 + rsvp.guestCount
    if (rsvp.status === 'DOWN') down += total
    else if (rsvp.status === 'MAYBE') maybe += total
    else if (rsvp.status === 'NOT_DOWN') notDown += total
  }

  return { down, maybe, notDown }
}
