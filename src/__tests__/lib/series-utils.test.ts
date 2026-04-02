import { describe, it, expect } from 'vitest'
import { generateEventDates, getWeekOfMonth } from '@/lib/series-utils'

describe('generateEventDates', () => {
  it('generates weekly dates', () => {
    const dates = generateEventDates({
      recurrence: 'WEEKLY',
      dayOfWeek: 3, // Wednesday
      timeOfDay: '19:00',
      startsAt: new Date('2026-04-01'),
      endsAt: null,
      skippedDates: [],
      count: 4,
    })
    expect(dates).toHaveLength(4)
    expect(dates[0].getDay()).toBe(3)
    expect(dates[1].getTime() - dates[0].getTime()).toBe(7 * 24 * 60 * 60 * 1000)
  })

  it('generates biweekly dates', () => {
    const dates = generateEventDates({
      recurrence: 'BIWEEKLY',
      dayOfWeek: 5, // Friday
      timeOfDay: '18:00',
      startsAt: new Date('2026-04-01'),
      endsAt: null,
      skippedDates: [],
      count: 3,
    })
    expect(dates).toHaveLength(3)
    expect(dates[1].getTime() - dates[0].getTime()).toBe(14 * 24 * 60 * 60 * 1000)
  })

  it('generates monthly dates for Nth weekday (e.g., 1st Saturday)', () => {
    // April 4, 2026 is the 1st Saturday of April
    const dates = generateEventDates({
      recurrence: 'MONTHLY',
      dayOfWeek: 6, // Saturday
      weekOfMonth: 1, // 1st Saturday
      timeOfDay: '10:00',
      startsAt: new Date('2026-04-01'),
      endsAt: null,
      skippedDates: [],
      count: 3,
    })
    expect(dates).toHaveLength(3)
    // Each date should be the 1st Saturday of its month
    for (const d of dates) {
      expect(d.getDay()).toBe(6) // Saturday
      expect(d.getDate()).toBeLessThanOrEqual(7) // 1st occurrence is always within first 7 days
    }
    // Each in a different month
    const months = dates.map((d) => d.getMonth())
    expect(new Set(months).size).toBe(3)
  })

  it('generates 3rd Friday of each month', () => {
    // April 17, 2026 is the 3rd Friday
    const dates = generateEventDates({
      recurrence: 'MONTHLY',
      dayOfWeek: 5, // Friday
      weekOfMonth: 3, // 3rd Friday
      timeOfDay: '18:00',
      startsAt: new Date('2026-04-01'),
      endsAt: null,
      skippedDates: [],
      count: 3,
    })
    expect(dates).toHaveLength(3)
    for (const d of dates) {
      expect(d.getDay()).toBe(5) // Friday
      expect(getWeekOfMonth(d)).toBe(3) // 3rd occurrence
    }
  })

  it('respects endsAt boundary', () => {
    const dates = generateEventDates({
      recurrence: 'WEEKLY',
      dayOfWeek: 1,
      timeOfDay: '12:00',
      startsAt: new Date('2026-04-01'),
      endsAt: new Date('2026-04-20'),
      skippedDates: [],
      count: 8,
    })
    expect(dates.every((d) => d < new Date('2026-04-20'))).toBe(true)
  })

  it('skips dates in skippedDates', () => {
    const skipped = new Date('2026-04-08T19:00:00')
    const dates = generateEventDates({
      recurrence: 'WEEKLY',
      dayOfWeek: 3,
      timeOfDay: '19:00',
      startsAt: new Date('2026-04-01'),
      endsAt: null,
      skippedDates: [skipped],
      count: 4,
    })
    expect(dates.every((d) => d.getTime() !== skipped.getTime())).toBe(true)
  })

  it('generates dates starting from startsAt, not before', () => {
    const dates = generateEventDates({
      recurrence: 'WEEKLY',
      dayOfWeek: 3,
      timeOfDay: '19:00',
      startsAt: new Date('2026-04-10'),
      endsAt: null,
      skippedDates: [],
      count: 2,
    })
    expect(dates.every((d) => d >= new Date('2026-04-10'))).toBe(true)
  })
})
