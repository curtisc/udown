type GenerateParams = {
  recurrence: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'
  dayOfWeek: number // 0=Sunday .. 6=Saturday
  weekOfMonth?: number // 1-5 for MONTHLY (e.g., 1 = first Friday, 3 = third Monday)
  timeOfDay: string // HH:mm
  startsAt: Date
  endsAt: Date | null
  skippedDates: Date[]
  count: number // max instances to generate
}

/**
 * Find the Nth occurrence of a given weekday in a month.
 * e.g., getNthWeekdayOfMonth(2026, 3, 5, 1) = 1st Friday of April 2026
 */
function getNthWeekdayOfMonth(
  year: number,
  month: number,
  dayOfWeek: number,
  n: number
): Date | null {
  const date = new Date(year, month, 1)
  let count = 0

  while (date.getMonth() === month) {
    if (date.getDay() === dayOfWeek) {
      count++
      if (count === n) return new Date(date)
    }
    date.setDate(date.getDate() + 1)
  }

  return null // e.g., no 5th Friday this month
}

/**
 * Determine which occurrence of its weekday a date is within its month.
 * e.g., April 17 2026 (Friday) → 3 (3rd Friday of the month)
 */
export function getWeekOfMonth(date: Date): number {
  const day = date.getDate()
  return Math.ceil(day / 7)
}

export function generateEventDates(params: GenerateParams): Date[] {
  const { recurrence, dayOfWeek, weekOfMonth, timeOfDay, startsAt, endsAt, skippedDates, count } = params
  const [hours, minutes] = timeOfDay.split(':').map(Number)
  const skippedSet = new Set(skippedDates.map((d) => d.getTime()))
  const dates: Date[] = []

  // Find the first occurrence on or after startsAt
  const cursor = new Date(startsAt)
  cursor.setHours(hours, minutes, 0, 0)

  // Advance to the correct day of week
  while (cursor.getDay() !== dayOfWeek) {
    cursor.setDate(cursor.getDate() + 1)
  }

  // If we landed before startsAt, move forward
  if (cursor < startsAt) {
    if (recurrence === 'WEEKLY') cursor.setDate(cursor.getDate() + 7)
    else if (recurrence === 'BIWEEKLY') cursor.setDate(cursor.getDate() + 14)
    else {
      // For monthly, jump to next month and find the right occurrence
      cursor.setMonth(cursor.getMonth() + 1)
    }
  }

  let safety = 0
  while (dates.length < count && safety < 200) {
    safety++

    let candidate: Date

    if (recurrence === 'MONTHLY' && weekOfMonth) {
      // Find the Nth weekday of the cursor's month
      const found = getNthWeekdayOfMonth(
        cursor.getFullYear(),
        cursor.getMonth(),
        dayOfWeek,
        weekOfMonth
      )
      if (!found) {
        // Skip months that don't have this occurrence (e.g., no 5th Friday)
        cursor.setMonth(cursor.getMonth() + 1)
        continue
      }
      candidate = new Date(found)
      candidate.setHours(hours, minutes, 0, 0)

      // Make sure we haven't gone backwards
      if (candidate < startsAt) {
        cursor.setMonth(cursor.getMonth() + 1)
        continue
      }
    } else {
      candidate = new Date(cursor)
    }

    if (endsAt && candidate >= endsAt) break

    if (!skippedSet.has(candidate.getTime())) {
      dates.push(candidate)
    }

    // Advance cursor
    if (recurrence === 'WEEKLY') {
      cursor.setDate(cursor.getDate() + 7)
    } else if (recurrence === 'BIWEEKLY') {
      cursor.setDate(cursor.getDate() + 14)
    } else {
      cursor.setMonth(cursor.getMonth() + 1)
    }
  }

  return dates
}
