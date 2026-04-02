'use client'

type Props = {
  isRecurring: boolean
  onToggle: (recurring: boolean) => void
  recurrence: string
  onRecurrenceChange: (value: string) => void
  seriesEndsAt: string
  onEndsAtChange: (value: string) => void
  startDate?: Date | null
}

const ordinals = ['', '1st', '2nd', '3rd', '4th', '5th']
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function RecurringOptions({
  isRecurring,
  onToggle,
  recurrence,
  onRecurrenceChange,
  seriesEndsAt,
  onEndsAtChange,
  startDate,
}: Props) {
  const inputClasses = "mt-1 w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)] focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"

  // Build a friendly monthly label like "Monthly (3rd Friday)"
  let monthlyLabel = 'Monthly'
  if (startDate) {
    const weekNum = Math.ceil(startDate.getDate() / 7)
    const dayName = dayNames[startDate.getDay()]
    monthlyLabel = `Monthly (${ordinals[weekNum]} ${dayName})`
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => onToggle(!isRecurring)}
        className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        <div
          className={`relative h-5 w-9 rounded-full transition-colors ${
            isRecurring ? 'bg-[var(--brand-accent)]' : 'bg-[var(--bg-surface)]'
          }`}
        >
          <div
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              isRecurring ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </div>
        Make this recurring
      </button>

      {isRecurring && (
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-[var(--bg-surface)] p-3">
          <div>
            <label htmlFor="recurrence" className="block text-xs font-medium text-[var(--text-secondary)]">
              Repeats
            </label>
            <select
              id="recurrence"
              name="recurrence"
              value={recurrence}
              onChange={(e) => onRecurrenceChange(e.target.value)}
              className={inputClasses}
            >
              <option value="WEEKLY">Weekly</option>
              <option value="BIWEEKLY">Every 2 weeks</option>
              <option value="MONTHLY">{monthlyLabel}</option>
            </select>
          </div>
          <div>
            <label htmlFor="seriesEndsAt" className="block text-xs font-medium text-[var(--text-secondary)]">
              Until (optional)
            </label>
            <input
              id="seriesEndsAt"
              name="seriesEndsAt"
              type="date"
              value={seriesEndsAt}
              onChange={(e) => onEndsAtChange(e.target.value)}
              className={inputClasses}
            />
          </div>
        </div>
      )}
    </div>
  )
}
