'use client'

import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

type Props = {
  name: string
  label: string
  required?: boolean
  value: Date | null
  onChange: (date: Date | null) => void
  minDate?: Date | null
  minTime?: Date | null
}

function roundUpTo15Min(date: Date): Date {
  const ms = 15 * 60 * 1000
  return new Date(Math.ceil(date.getTime() / ms) * ms)
}

export function DateTimePicker({ name, label, required, value, onChange, minDate, minTime }: Props) {
  const now = new Date()
  const effectiveMinDate = minDate || now

  // Determine if selected date is today (or the same day as minDate)
  const isMinDay = value &&
    value.toDateString() === effectiveMinDate.toDateString()

  // On the min day, don't allow times before now (or the provided minTime)
  const effectiveMinTime = isMinDay
    ? (minTime && minTime > now ? minTime : roundUpTo15Min(now))
    : undefined
  const effectiveMaxTime = isMinDay
    ? new Date(new Date().setHours(23, 59, 0, 0))
    : undefined

  // Default open: today at the next 15-min mark, or noon if that's past
  const defaultOpen = roundUpTo15Min(now)
  if (defaultOpen.getHours() < 12) defaultOpen.setHours(12, 0, 0, 0)

  return (
    <div>
      <label className="block text-sm font-medium text-[var(--text-primary)]">
        {label} {required && '*'}
      </label>
      <DatePicker
        selected={value}
        onChange={onChange}
        showTimeSelect
        timeIntervals={15}
        dateFormat="MMM d, yyyy h:mm aa"
        placeholderText="Pick a date and time"
        required={required}
        minDate={effectiveMinDate}
        minTime={effectiveMinTime}
        maxTime={effectiveMaxTime}
        openToDate={value || defaultOpen}
        className="mt-1 w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
        calendarClassName="udown-datepicker"
        wrapperClassName="w-full"
      />
      <input type="hidden" name={name} value={value?.toISOString() || ''} />
    </div>
  )
}
