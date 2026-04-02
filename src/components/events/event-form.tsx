'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { TagSelector } from '@/components/events/tag-selector'
import { RecurringOptions } from '@/components/events/recurring-options'

// These components use browser-only APIs (Google Maps, react-datepicker)
// Skip SSR to avoid hydration mismatches
const DateTimePicker = dynamic(
  () => import('@/components/events/date-time-picker').then((m) => m.DateTimePicker),
  { ssr: false, loading: () => <div className="h-10 rounded-lg bg-[var(--bg-card)] animate-pulse" /> }
)
const PlacesAutocomplete = dynamic(
  () => import('@/components/events/places-autocomplete').then((m) => m.PlacesAutocomplete),
  { ssr: false, loading: () => <div className="h-10 rounded-lg bg-[var(--bg-card)] animate-pulse" /> }
)

type EventFormProps = {
  action: (formData: FormData) => Promise<void>
  defaultValues?: {
    title?: string
    description?: string | null
    dateTime?: string // ISO string
    endTime?: string | null // ISO string
    placeName?: string | null
    placeAddress?: string | null
    estimatedCost?: number | null
    capacity?: number | null
    groupId?: string
    tagIds?: string[]
  }
  submitLabel: string
  groups?: Array<{ id: string; name: string }>
  availableTags?: Array<{ id: string; name: string }>
}

export function EventForm({ action, defaultValues, submitLabel, groups, availableTags }: EventFormProps) {
  const [dateTime, setDateTime] = useState<Date | null>(
    defaultValues?.dateTime ? new Date(defaultValues.dateTime) : null
  )
  const [endTime, setEndTime] = useState<Date | null>(
    defaultValues?.endTime ? new Date(defaultValues.endTime) : null
  )

  function handleStartTimeChange(date: Date | null) {
    setDateTime(date)
    if (date) {
      // Auto-set end time to 1 hour after start if end time is unset or before start
      const oneHourLater = new Date(date.getTime() + 60 * 60 * 1000)
      if (!endTime || endTime <= date) {
        setEndTime(oneHourLater)
      }
    }
  }
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(defaultValues?.tagIds || [])
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrence, setRecurrence] = useState('WEEKLY')
  const [seriesEndsAt, setSeriesEndsAt] = useState('')

  return (
    <form action={action} className="space-y-4">
      {groups && groups.length > 1 && (
        <div>
          <label htmlFor="groupId" className="block text-sm font-medium text-[var(--text-primary)]">
            Post in group *
          </label>
          <select
            id="groupId"
            name="groupId"
            required
            defaultValue={defaultValues?.groupId || groups[0].id}
            className="mt-1 w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)] focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      )}
      {groups && groups.length === 1 && (
        <input type="hidden" name="groupId" value={groups[0].id} />
      )}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-[var(--text-primary)]">
          What&apos;s happening? *
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={defaultValues?.title}
          placeholder="Board Game Night, Park Hangout, etc."
          className="mt-1 w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-[var(--text-primary)]">
          Details *
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          required
          defaultValue={defaultValues?.description || ''}
          placeholder="What should people know?"
          className="mt-1 w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <DateTimePicker
          name="dateTime"
          label="When?"
          required
          value={dateTime}
          onChange={handleStartTimeChange}
        />
        <DateTimePicker
          name="endTime"
          label="Until"
          value={endTime}
          onChange={setEndTime}
          minDate={dateTime}
          minTime={dateTime ? new Date(dateTime.getTime() + 30 * 60 * 1000) : null}
        />
      </div>

      <PlacesAutocomplete
        defaultPlaceName={defaultValues?.placeName}
        defaultPlaceAddress={defaultValues?.placeAddress}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="estimatedCost" className="block text-sm font-medium text-[var(--text-primary)]">
            Cost per person
          </label>
          <input
            id="estimatedCost"
            name="estimatedCost"
            type="number"
            min="0"
            step="0.01"
            defaultValue={defaultValues?.estimatedCost ?? ''}
            placeholder="$0"
            className="mt-1 w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
          />
        </div>
        <div>
          <label htmlFor="capacity" className="block text-sm font-medium text-[var(--text-primary)]">
            Max people
          </label>
          <input
            id="capacity"
            name="capacity"
            type="number"
            min="1"
            defaultValue={defaultValues?.capacity ?? ''}
            placeholder="No limit"
            className="mt-1 w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
          />
        </div>
      </div>

      <RecurringOptions
        isRecurring={isRecurring}
        onToggle={setIsRecurring}
        recurrence={recurrence}
        onRecurrenceChange={setRecurrence}
        seriesEndsAt={seriesEndsAt}
        onEndsAtChange={setSeriesEndsAt}
        startDate={dateTime}
      />
      <input type="hidden" name="isRecurring" value={isRecurring ? 'true' : ''} />

      {availableTags && (
        <TagSelector
          availableTags={availableTags}
          selectedTagIds={selectedTagIds}
          onChange={setSelectedTagIds}
        />
      )}
      <input type="hidden" name="tagIds" value={JSON.stringify(selectedTagIds)} />

      <button
        type="submit"
        className="w-full rounded-lg bg-[var(--brand-accent)] px-4 py-3 font-semibold text-white transition-opacity hover:opacity-90"
      >
        {submitLabel}
      </button>
    </form>
  )
}
