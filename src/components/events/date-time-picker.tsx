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

export function DateTimePicker({ name, label, required, value, onChange, minDate, minTime }: Props) {
  // When no time is selected yet, open the time list scrolled to 5 PM
  // by setting openToDate to today at 5 PM
  const defaultOpenDate = new Date()
  defaultOpenDate.setHours(12, 0, 0, 0)

  // For the same-day min time restriction
  const isSameDay = minDate && value &&
    minDate.toDateString() === value.toDateString()

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
        minDate={minDate || undefined}
        minTime={isSameDay && minTime ? minTime : undefined}
        maxTime={isSameDay && minTime ? new Date(new Date().setHours(23, 59, 0, 0)) : undefined}
        openToDate={value || defaultOpenDate}
        className="mt-1 w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
        calendarClassName="udown-datepicker"
        wrapperClassName="w-full"
      />
      <input type="hidden" name={name} value={value?.toISOString() || ''} />
    </div>
  )
}
