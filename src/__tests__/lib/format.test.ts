import { describe, it, expect } from 'vitest'
import { formatEventDate, formatEventTime, formatCost, formatAttendeeCounts } from '@/lib/format'

describe('formatEventDate', () => {
  it('formats a date as readable string', () => {
    const date = new Date('2026-04-15T14:00:00')
    expect(formatEventDate(date)).toBe('Wed, Apr 15')
  })

  it('shows "Today" for today', () => {
    const now = new Date()
    expect(formatEventDate(now)).toBe('Today')
  })

  it('shows "Tomorrow" for tomorrow', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    expect(formatEventDate(tomorrow)).toBe('Tomorrow')
  })
})

describe('formatEventTime', () => {
  it('formats time in 12-hour format', () => {
    const date = new Date('2026-04-15T14:00:00')
    expect(formatEventTime(date)).toBe('2:00 PM')
  })

  it('formats midnight correctly', () => {
    const date = new Date('2026-04-15T00:00:00')
    expect(formatEventTime(date)).toBe('12:00 AM')
  })

  it('formats noon correctly', () => {
    const date = new Date('2026-04-15T12:00:00')
    expect(formatEventTime(date)).toBe('12:00 PM')
  })
})

describe('formatCost', () => {
  it('formats a whole dollar amount', () => {
    expect(formatCost(15)).toBe('$15')
  })

  it('formats a decimal amount', () => {
    expect(formatCost(15.5)).toBe('$15.50')
  })

  it('returns null for zero', () => {
    expect(formatCost(0)).toBeNull()
  })

  it('returns null for null input', () => {
    expect(formatCost(null)).toBeNull()
  })
})

describe('formatAttendeeCounts', () => {
  it('counts RSVPs with guest totals', () => {
    const rsvps = [
      { status: 'DOWN' as const, guestCount: 2 },
      { status: 'DOWN' as const, guestCount: 0 },
      { status: 'MAYBE' as const, guestCount: 1 },
      { status: 'NOT_DOWN' as const, guestCount: 0 },
    ]
    expect(formatAttendeeCounts(rsvps)).toEqual({
      down: 4,
      maybe: 2,
      notDown: 1,
    })
  })

  it('returns zeros for empty RSVPs', () => {
    expect(formatAttendeeCounts([])).toEqual({ down: 0, maybe: 0, notDown: 0 })
  })
})
