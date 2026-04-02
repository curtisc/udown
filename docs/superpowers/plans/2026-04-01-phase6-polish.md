# Phase 6: Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google Places autocomplete for event locations, tag-based event filtering, recurring events with Google Calendar-style edit/delete, and inactivity nudge notifications.

**Architecture:** Google Places Autocomplete via `@react-google-maps/api` as a client component wrapping the location input. Tags stored via EventTag join table with inline create-new in the event form. EventSeries generates 8 future Event instances on creation; a cron job maintains the 8-week lookahead. Recurring event edit/delete uses a client-side modal with three options. Inactivity nudges added to the existing hourly cron.

**Tech Stack:** Next.js 16, TypeScript, Tailwind v4, Prisma v7, `@react-google-maps/api`, Vitest

**Codebase notes:**
- Event form is already a client component at `src/components/events/event-form.tsx`
- Event actions at `src/lib/actions/events.ts` handle create/update/delete
- Cron job at `src/app/api/cron/notifications/route.ts` currently only sends reminders
- EventSeries, Tag, EventTag models are already in the Prisma schema
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` env var for Google Places

---

## File Map

**New files:**
```
src/components/events/places-autocomplete.tsx    # Google Places Autocomplete wrapper
src/components/events/tag-selector.tsx           # Tag multi-select with inline create
src/components/events/recurring-options.tsx       # Recurring event toggle + recurrence picker
src/components/events/series-edit-modal.tsx       # "This only / Future / All" modal
src/lib/actions/tags.ts                          # Tag CRUD server actions
src/lib/actions/series.ts                        # EventSeries CRUD + instance generation
src/lib/series-utils.ts                          # Pure functions for generating event dates
src/__tests__/lib/series-utils.test.ts           # Series date generation tests
src/lib/notifications/inactivity-nudge.ts        # Nudge email template + trigger
```

**Modified files:**
```
src/components/events/event-form.tsx              # Add Places, tags, recurring options
src/lib/actions/events.ts                         # Handle tags + series on create/update/delete
src/app/(app)/feed/page.tsx                       # Add tag filter
src/app/(app)/events/[id]/page.tsx                # Show tags, series edit/delete modal
src/app/(app)/events/[id]/edit/page.tsx           # Handle series editing
src/app/api/cron/notifications/route.ts           # Add instance generation + nudges
src/lib/notifications/triggers.ts                 # Add nudge function
```

---

### Task 1: Series Date Generation Utilities (TDD)

**Files:**
- Create: `src/lib/series-utils.ts`, `src/__tests__/lib/series-utils.test.ts`

- [ ] **Step 1: Write the failing tests**

Write to `src/__tests__/lib/series-utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { generateEventDates } from '@/lib/series-utils'

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

  it('generates monthly dates', () => {
    const dates = generateEventDates({
      recurrence: 'MONTHLY',
      dayOfWeek: 6, // Saturday
      timeOfDay: '10:00',
      startsAt: new Date('2026-04-01'),
      endsAt: null,
      skippedDates: [],
      count: 3,
    })
    expect(dates).toHaveLength(3)
    // Each date should be in a different month
    const months = dates.map((d) => d.getMonth())
    expect(new Set(months).size).toBe(3)
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/lib/series-utils.test.ts
```

- [ ] **Step 3: Write the implementation**

Write to `src/lib/series-utils.ts`:

```typescript
type GenerateParams = {
  recurrence: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'
  dayOfWeek: number // 0=Sunday .. 6=Saturday
  timeOfDay: string // HH:mm
  startsAt: Date
  endsAt: Date | null
  skippedDates: Date[]
  count: number // max instances to generate
}

export function generateEventDates(params: GenerateParams): Date[] {
  const { recurrence, dayOfWeek, timeOfDay, startsAt, endsAt, skippedDates, count } = params
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
    else cursor.setMonth(cursor.getMonth() + 1)
  }

  let safety = 0
  while (dates.length < count && safety < 200) {
    safety++
    const candidate = new Date(cursor)

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
      // MONTHLY: same day-of-week in next month (e.g., first Saturday of each month)
      // Simple approach: advance by ~4 weeks, then find next matching dayOfWeek
      cursor.setMonth(cursor.getMonth() + 1)
      cursor.setDate(1)
      while (cursor.getDay() !== dayOfWeek) {
        cursor.setDate(cursor.getDate() + 1)
      }
      cursor.setHours(hours, minutes, 0, 0)
    }
  }

  return dates
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/__tests__/lib/series-utils.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/series-utils.ts src/__tests__/lib/series-utils.test.ts
git commit -m "feat: add series date generation utilities"
```

---

### Task 2: EventSeries Server Actions

**Files:**
- Create: `src/lib/actions/series.ts`

- [ ] **Step 1: Create series actions**

Write to `src/lib/actions/series.ts`:

```typescript
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { generateEventDates } from '@/lib/series-utils'
import { logActivity } from '@/lib/activity-log'

export async function createEventSeries(formData: FormData) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const groupId = formData.get('groupId') as string
  if (!groupId) throw new Error('Group is required')

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  })
  if (!membership) throw new Error('Not a member of this group')

  const title = (formData.get('title') as string)?.trim()
  if (!title) throw new Error('Title is required')

  const recurrence = formData.get('recurrence') as 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'
  const dateTimeStr = formData.get('dateTime') as string
  if (!dateTimeStr) throw new Error('Date/time is required')

  const startDate = new Date(dateTimeStr)
  const dayOfWeek = startDate.getDay()
  const timeOfDay = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`

  const endTimeStr = formData.get('endTime') as string
  let durationMinutes: number | null = null
  if (endTimeStr) {
    const endDate = new Date(endTimeStr)
    durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000)
  }

  const endsAtStr = formData.get('seriesEndsAt') as string
  const costStr = formData.get('estimatedCost') as string
  const capacityStr = formData.get('capacity') as string
  const tagIdsStr = formData.get('tagIds') as string

  const series = await prisma.eventSeries.create({
    data: {
      groupId,
      createdById: session.user.id,
      recurrence,
      dayOfWeek,
      timeOfDay,
      durationMinutes,
      title,
      description: (formData.get('description') as string)?.trim() || null,
      placeName: (formData.get('placeName') as string)?.trim() || null,
      placeAddress: (formData.get('placeAddress') as string)?.trim() || null,
      placeLat: formData.get('placeLat') ? parseFloat(formData.get('placeLat') as string) : null,
      placeLng: formData.get('placeLng') ? parseFloat(formData.get('placeLng') as string) : null,
      placeId: (formData.get('placeId') as string) || null,
      estimatedCost: costStr ? parseFloat(costStr) : null,
      capacity: capacityStr ? parseInt(capacityStr, 10) : null,
      tagIds: tagIdsStr ? JSON.parse(tagIdsStr) : [],
      startsAt: startDate,
      endsAt: endsAtStr ? new Date(endsAtStr) : null,
    },
  })

  // Generate initial instances
  await generateSeriesInstances(series.id, 8)

  await prisma.group.update({
    where: { id: groupId },
    data: { lastEventAt: new Date() },
  })

  logActivity({
    actorId: session.user.id,
    action: 'EVENT_CREATED',
    targetType: 'EVENT',
    targetId: series.id,
    metadata: { eventTitle: title, recurring: recurrence },
  })

  revalidatePath('/feed')
  redirect('/feed')
}

export async function generateSeriesInstances(
  seriesId: string,
  count: number
): Promise<number> {
  const series = await prisma.eventSeries.findUnique({
    where: { id: seriesId },
    include: { events: { select: { dateTime: true }, orderBy: { dateTime: 'desc' }, take: 1 } },
  })
  if (!series) return 0

  // Start generating from after the last existing instance, or from startsAt
  const lastEvent = series.events[0]
  const startFrom = lastEvent
    ? new Date(lastEvent.dateTime.getTime() + 1000) // 1 second after last
    : series.startsAt

  const dates = generateEventDates({
    recurrence: series.recurrence as 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY',
    dayOfWeek: series.dayOfWeek,
    timeOfDay: series.timeOfDay,
    startsAt: startFrom,
    endsAt: series.endsAt,
    skippedDates: series.skippedDates,
    count,
  })

  for (const date of dates) {
    const endTime = series.durationMinutes
      ? new Date(date.getTime() + series.durationMinutes * 60000)
      : null

    await prisma.event.create({
      data: {
        title: series.title,
        description: series.description,
        dateTime: date,
        endTime,
        placeName: series.placeName,
        placeAddress: series.placeAddress,
        placeLat: series.placeLat,
        placeLng: series.placeLng,
        placeId: series.placeId,
        estimatedCost: series.estimatedCost,
        capacity: series.capacity,
        groupId: series.groupId,
        createdById: series.createdById,
        seriesId: series.id,
      },
    })

    // Create tag associations
    if (series.tagIds.length > 0) {
      const event = await prisma.event.findFirst({
        where: { dateTime: date, seriesId: series.id },
      })
      if (event) {
        for (const tagId of series.tagIds) {
          await prisma.eventTag.create({
            data: { eventId: event.id, tagId },
          }).catch(() => {}) // Ignore if tag doesn't exist
        }
      }
    }
  }

  return dates.length
}

export async function editSeriesEvent(
  eventId: string,
  scope: 'this' | 'future' | 'all',
  formData: FormData
) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { series: true },
  })
  if (!event?.series) throw new Error('Not a series event')

  if (scope === 'this') {
    // Edit just this instance
    await prisma.event.update({
      where: { id: eventId },
      data: {
        title: (formData.get('title') as string)?.trim() || event.title,
        description: (formData.get('description') as string)?.trim() || null,
        dateTime: formData.get('dateTime') ? new Date(formData.get('dateTime') as string) : event.dateTime,
        endTime: formData.get('endTime') ? new Date(formData.get('endTime') as string) : event.endTime,
        placeName: (formData.get('placeName') as string)?.trim() || null,
        placeAddress: (formData.get('placeAddress') as string)?.trim() || null,
        estimatedCost: formData.get('estimatedCost') ? parseFloat(formData.get('estimatedCost') as string) : null,
        capacity: formData.get('capacity') ? parseInt(formData.get('capacity') as string, 10) : null,
        isModified: true,
      },
    })
  } else {
    // Update the series template
    const title = (formData.get('title') as string)?.trim() || event.series.title
    await prisma.eventSeries.update({
      where: { id: event.series.id },
      data: {
        title,
        description: (formData.get('description') as string)?.trim() || null,
        placeName: (formData.get('placeName') as string)?.trim() || null,
        placeAddress: (formData.get('placeAddress') as string)?.trim() || null,
        estimatedCost: formData.get('estimatedCost') ? parseFloat(formData.get('estimatedCost') as string) : null,
        capacity: formData.get('capacity') ? parseInt(formData.get('capacity') as string, 10) : null,
      },
    })

    // Update future instances
    const where = scope === 'all'
      ? { seriesId: event.series.id, dateTime: { gte: new Date() } }
      : { seriesId: event.series.id, dateTime: { gte: event.dateTime }, isModified: false }

    await prisma.event.updateMany({
      where,
      data: {
        title,
        description: (formData.get('description') as string)?.trim() || null,
        placeName: (formData.get('placeName') as string)?.trim() || null,
        placeAddress: (formData.get('placeAddress') as string)?.trim() || null,
        estimatedCost: formData.get('estimatedCost') ? parseFloat(formData.get('estimatedCost') as string) : null,
        capacity: formData.get('capacity') ? parseInt(formData.get('capacity') as string, 10) : null,
      },
    })
  }

  revalidatePath('/feed')
  revalidatePath(`/events/${eventId}`)
  redirect(`/events/${eventId}`)
}

export async function deleteSeriesEvent(
  eventId: string,
  scope: 'this' | 'future' | 'all'
) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { series: true },
  })
  if (!event?.series) throw new Error('Not a series event')

  if (scope === 'this') {
    await prisma.event.delete({ where: { id: eventId } })
    await prisma.eventSeries.update({
      where: { id: event.series.id },
      data: { skippedDates: { push: event.dateTime } },
    })
  } else if (scope === 'future') {
    await prisma.event.deleteMany({
      where: { seriesId: event.series.id, dateTime: { gte: event.dateTime } },
    })
    await prisma.eventSeries.update({
      where: { id: event.series.id },
      data: { endsAt: event.dateTime },
    })
  } else {
    // Delete all future instances and the series
    await prisma.event.deleteMany({
      where: { seriesId: event.series.id, dateTime: { gte: new Date() } },
    })
    await prisma.eventSeries.delete({ where: { id: event.series.id } })
  }

  logActivity({
    actorId: session.user.id,
    action: 'EVENT_DELETED',
    targetType: 'EVENT',
    targetId: eventId,
    metadata: { eventTitle: event.title, scope },
  })

  revalidatePath('/feed')
  redirect('/feed')
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/series.ts
git commit -m "feat: add EventSeries CRUD and instance generation actions"
```

---

### Task 3: Tag Server Actions

**Files:**
- Create: `src/lib/actions/tags.ts`

- [ ] **Step 1: Create tag actions**

Write to `src/lib/actions/tags.ts`:

```typescript
'use server'

import { prisma } from '@/lib/prisma'

export async function getTags() {
  return prisma.tag.findMany({ orderBy: { name: 'asc' } })
}

export async function createTag(name: string) {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return prisma.tag.upsert({
    where: { slug },
    create: { name: name.trim(), slug },
    update: {},
  })
}

export async function setEventTags(eventId: string, tagIds: string[]) {
  // Remove existing tags
  await prisma.eventTag.deleteMany({ where: { eventId } })

  // Add new tags
  for (const tagId of tagIds) {
    await prisma.eventTag.create({
      data: { eventId, tagId },
    }).catch(() => {}) // Ignore invalid tagIds
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/tags.ts
git commit -m "feat: add tag CRUD server actions"
```

---

### Task 4: Google Places Autocomplete Component

**Files:**
- Create: `src/components/events/places-autocomplete.tsx`

- [ ] **Step 1: Install the library**

```bash
npm install @react-google-maps/api
```

- [ ] **Step 2: Create the Places Autocomplete wrapper**

Write to `src/components/events/places-autocomplete.tsx`:

```typescript
'use client'

import { useState, useCallback } from 'react'
import { useLoadScript, Autocomplete } from '@react-google-maps/api'

const libraries: ('places')[] = ['places']

type PlaceData = {
  placeName: string
  placeAddress: string
  placeLat: number | null
  placeLng: number | null
  placeId: string | null
}

type Props = {
  defaultPlaceName?: string | null
  defaultPlaceAddress?: string | null
  onSelect?: (data: PlaceData) => void
}

export function PlacesAutocomplete({ defaultPlaceName, defaultPlaceAddress, onSelect }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: apiKey || '',
    libraries,
  })

  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null)
  const [placeName, setPlaceName] = useState(defaultPlaceName || '')
  const [placeAddress, setPlaceAddress] = useState(defaultPlaceAddress || '')
  const [placeLat, setPlaceLat] = useState<number | null>(null)
  const [placeLng, setPlaceLng] = useState<number | null>(null)
  const [placeId, setPlaceId] = useState<string | null>(null)

  const onPlaceChanged = useCallback(() => {
    if (!autocomplete) return
    const place = autocomplete.getPlace()

    const data: PlaceData = {
      placeName: place.name || '',
      placeAddress: place.formatted_address || '',
      placeLat: place.geometry?.location?.lat() ?? null,
      placeLng: place.geometry?.location?.lng() ?? null,
      placeId: place.place_id || null,
    }

    setPlaceName(data.placeName)
    setPlaceAddress(data.placeAddress)
    setPlaceLat(data.placeLat)
    setPlaceLng(data.placeLng)
    setPlaceId(data.placeId)
    onSelect?.(data)
  }, [autocomplete, onSelect])

  const inputClasses = "mt-1 w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="placeName" className="block text-sm font-medium text-[var(--text-primary)]">
          Where?
        </label>
        {isLoaded && apiKey ? (
          <Autocomplete
            onLoad={setAutocomplete}
            onPlaceChanged={onPlaceChanged}
          >
            <input
              id="placeName"
              name="placeName"
              type="text"
              value={placeName}
              onChange={(e) => setPlaceName(e.target.value)}
              placeholder="Search for a place..."
              className={inputClasses}
            />
          </Autocomplete>
        ) : (
          <input
            id="placeName"
            name="placeName"
            type="text"
            value={placeName}
            onChange={(e) => setPlaceName(e.target.value)}
            placeholder="Dolores Park, My apartment, etc."
            className={inputClasses}
          />
        )}
      </div>

      <div>
        <label htmlFor="placeAddress" className="block text-sm font-medium text-[var(--text-primary)]">
          Address
        </label>
        <input
          id="placeAddress"
          name="placeAddress"
          type="text"
          value={placeAddress}
          onChange={(e) => setPlaceAddress(e.target.value)}
          placeholder="123 Main St"
          className={inputClasses}
        />
      </div>

      {/* Hidden fields for lat/lng/placeId */}
      <input type="hidden" name="placeLat" value={placeLat ?? ''} />
      <input type="hidden" name="placeLng" value={placeLng ?? ''} />
      <input type="hidden" name="placeId" value={placeId ?? ''} />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/events/places-autocomplete.tsx package.json package-lock.json
git commit -m "feat: add Google Places Autocomplete component"
```

---

### Task 5: Tag Selector + Recurring Options Components

**Files:**
- Create: `src/components/events/tag-selector.tsx`, `src/components/events/recurring-options.tsx`

- [ ] **Step 1: Create tag selector**

Write to `src/components/events/tag-selector.tsx`:

```typescript
'use client'

import { useState, useTransition } from 'react'
import { createTag } from '@/lib/actions/tags'

type Tag = { id: string; name: string }

type Props = {
  availableTags: Tag[]
  selectedTagIds: string[]
  onChange: (tagIds: string[]) => void
}

export function TagSelector({ availableTags, selectedTagIds, onChange }: Props) {
  const [tags, setTags] = useState(availableTags)
  const [newTagName, setNewTagName] = useState('')
  const [isPending, startTransition] = useTransition()

  function toggleTag(tagId: string) {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId))
    } else {
      onChange([...selectedTagIds, tagId])
    }
  }

  function handleCreateTag() {
    if (!newTagName.trim()) return
    startTransition(async () => {
      const tag = await createTag(newTagName)
      setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)))
      onChange([...selectedTagIds, tag.id])
      setNewTagName('')
    })
  }

  return (
    <div>
      <label className="block text-sm font-medium text-[var(--text-primary)]">Tags</label>
      <div className="mt-1 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggleTag(tag.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selectedTagIds.includes(tag.id)
                ? 'bg-[var(--brand-accent)] text-white'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {tag.name}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreateTag())}
          placeholder="New tag..."
          className="flex-1 rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-card)] px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-[var(--brand-accent)] focus:outline-none"
        />
        <button
          type="button"
          onClick={handleCreateTag}
          disabled={isPending || !newTagName.trim()}
          className="rounded-lg bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create recurring event options**

Write to `src/components/events/recurring-options.tsx`:

```typescript
'use client'

type Props = {
  isRecurring: boolean
  onToggle: (recurring: boolean) => void
  recurrence: string
  onRecurrenceChange: (value: string) => void
  seriesEndsAt: string
  onEndsAtChange: (value: string) => void
}

export function RecurringOptions({
  isRecurring,
  onToggle,
  recurrence,
  onRecurrenceChange,
  seriesEndsAt,
  onEndsAtChange,
}: Props) {
  const inputClasses = "mt-1 w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)] focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"

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
              <option value="MONTHLY">Monthly</option>
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
```

- [ ] **Step 3: Commit**

```bash
git add src/components/events/tag-selector.tsx src/components/events/recurring-options.tsx
git commit -m "feat: add tag selector and recurring event options components"
```

---

### Task 6: Integrate All into Event Form + Actions

**Files:**
- Modify: `src/components/events/event-form.tsx`, `src/lib/actions/events.ts`, `src/app/(app)/events/new/page.tsx`, `src/app/(app)/events/[id]/page.tsx`

- [ ] **Step 1: Update event form to include Places, Tags, and Recurring**

Replace the event form to be a stateful client component that incorporates:
- `PlacesAutocomplete` instead of the plain location inputs
- `TagSelector` for tag selection (with hidden input for tagIds JSON)
- `RecurringOptions` toggle (with hidden inputs for recurrence, seriesEndsAt)
- Hidden input for `isRecurring` flag

The form needs `availableTags` and `groups` as props (fetched by the parent server component).

Add to `EventFormProps`:
```typescript
  availableTags?: Array<{ id: string; name: string }>
```

Replace the plain location inputs with `<PlacesAutocomplete>`. Add `<TagSelector>` before the submit button. Add `<RecurringOptions>` after the capacity field.

Add state for tag selection and recurring options:
```typescript
const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
const [isRecurring, setIsRecurring] = useState(false)
const [recurrence, setRecurrence] = useState('WEEKLY')
const [seriesEndsAt, setSeriesEndsAt] = useState('')
```

Add hidden inputs:
```typescript
<input type="hidden" name="tagIds" value={JSON.stringify(selectedTagIds)} />
<input type="hidden" name="isRecurring" value={isRecurring ? 'true' : ''} />
```

- [ ] **Step 2: Update createEvent action to handle tags and series**

In `src/lib/actions/events.ts`, in `createEvent`:

After creating the event, handle tags:
```typescript
  const tagIdsStr = formData.get('tagIds') as string
  if (tagIdsStr) {
    const tagIds = JSON.parse(tagIdsStr) as string[]
    const { setEventTags } = await import('@/lib/actions/tags')
    await setEventTags(event.id, tagIds)
  }
```

Check if recurring:
```typescript
  const isRecurring = formData.get('isRecurring') === 'true'
  if (isRecurring) {
    const { createEventSeries } = await import('@/lib/actions/series')
    await createEventSeries(formData)
    return // createEventSeries handles its own redirect
  }
```

Move this check to BEFORE the regular event creation so the flow is:
1. Check if recurring → delegate to `createEventSeries`
2. Otherwise → create single event as before

Also update `updateEvent` to handle tags.

Add `placeLat`, `placeLng`, `placeId` to the create/update data:
```typescript
  placeLat: formData.get('placeLat') ? parseFloat(formData.get('placeLat') as string) : null,
  placeLng: formData.get('placeLng') ? parseFloat(formData.get('placeLng') as string) : null,
  placeId: (formData.get('placeId') as string) || null,
```

- [ ] **Step 3: Update new event page to pass tags**

In `src/app/(app)/events/new/page.tsx`, fetch available tags and pass to form:

```typescript
import { getTags } from '@/lib/actions/tags'

// In the component:
const tags = await getTags()

// Pass to form:
<EventForm
  action={createEvent}
  submitLabel="Create Event"
  groups={groups}
  availableTags={tags}
  defaultValues={{ groupId: groupId || undefined }}
/>
```

- [ ] **Step 4: Update event detail page to show tags**

In `src/app/(app)/events/[id]/page.tsx`, include tags in the event query:

Add to the `prisma.event.findUnique` include:
```typescript
tags: { include: { tag: true } },
```

Render tags after the description:
```typescript
{event.tags.length > 0 && (
  <div className="flex flex-wrap gap-2">
    {event.tags.map((et) => (
      <span
        key={et.tag.id}
        className="rounded-full bg-[var(--bg-surface)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]"
      >
        {et.tag.name}
      </span>
    ))}
  </div>
)}
```

- [ ] **Step 5: Verify and commit**

```bash
npx tsc --noEmit && npx vitest run
git add -A
git commit -m "feat: integrate Places, tags, and recurring events into event form"
```

---

### Task 7: Tag Filter on Feed + Series Edit/Delete Modal

**Files:**
- Modify: `src/app/(app)/feed/page.tsx`
- Create: `src/components/events/series-edit-modal.tsx`

- [ ] **Step 1: Add tag filter to feed page**

In `src/app/(app)/feed/page.tsx`, accept `searchParams` for tag filtering:

```typescript
type Props = {
  searchParams: Promise<{ tag?: string }>
}

export default async function FeedPage({ searchParams }: Props) {
  const { tag } = await searchParams
  // ...
```

Add tag filter to the event query:
```typescript
const upcomingEvents = await prisma.event.findMany({
  where: {
    dateTime: { gte: now },
    group: { members: { some: { userId: session.user.id } } },
    ...(tag ? { tags: { some: { tag: { slug: tag } } } } : {}),
  },
  include: {
    rsvps: { include: { user: { select: { id: true, name: true, image: true } } } },
    tags: { include: { tag: true } },
  },
  orderBy: { dateTime: 'asc' },
})
```

Add a tag filter bar above the event list:
```typescript
const allTags = await prisma.tag.findMany({ orderBy: { name: 'asc' } })
```

Render tags as filter links:
```typescript
{allTags.length > 0 && (
  <div className="mb-4 flex flex-wrap gap-2">
    <Link
      href="/feed"
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        !tag ? 'bg-[var(--brand-accent)] text-white' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
      }`}
    >
      All
    </Link>
    {allTags.map((t) => (
      <Link
        key={t.id}
        href={`/feed?tag=${t.slug}`}
        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          tag === t.slug ? 'bg-[var(--brand-accent)] text-white' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
        }`}
      >
        {t.name}
      </Link>
    ))}
  </div>
)}
```

- [ ] **Step 2: Create series edit/delete modal**

Write to `src/components/events/series-edit-modal.tsx`:

```typescript
'use client'

import { useState, useTransition } from 'react'
import { deleteSeriesEvent } from '@/lib/actions/series'

type Props = {
  eventId: string
  action: 'delete'
  onClose: () => void
}

export function SeriesActionModal({ eventId, action, onClose }: Props) {
  const [scope, setScope] = useState<'this' | 'future' | 'all'>('this')
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      if (action === 'delete') {
        await deleteSeriesEvent(eventId, scope)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl bg-[var(--bg-card)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-bold text-[var(--text-primary)]">
          {action === 'delete' ? 'Delete recurring event' : 'Edit recurring event'}
        </h3>

        <div className="space-y-2">
          {(['this', 'future', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`w-full rounded-lg px-4 py-3 text-left text-sm transition-colors ${
                scope === s
                  ? 'bg-[var(--brand-accent)] text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-primary)]'
              }`}
            >
              {s === 'this' && 'This event only'}
              {s === 'future' && 'This and future events'}
              {s === 'all' && 'All events in series'}
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
              action === 'delete' ? 'bg-red-500' : 'bg-[var(--brand-accent)]'
            }`}
          >
            {isPending ? 'Working...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/feed/page.tsx src/components/events/series-edit-modal.tsx
git commit -m "feat: add tag filter to feed and series action modal"
```

---

### Task 8: Inactivity Nudges + Cron Updates

**Files:**
- Create: `src/lib/notifications/inactivity-nudge.ts`
- Modify: `src/app/api/cron/notifications/route.ts`, `src/lib/notifications/triggers.ts`

- [ ] **Step 1: Create inactivity nudge email + trigger**

Write to `src/lib/notifications/inactivity-nudge.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import { getOrgSettings } from '@/lib/org-settings'
import { sendEmail } from './send-email'
import { baseEmailHtml } from './templates'

export async function sendInactivityNudges(): Promise<number> {
  const now = new Date()
  let nudgeCount = 0

  const groups = await prisma.group.findMany({
    where: {
      isDefault: false, // Don't nudge for the default group
    },
    include: {
      members: {
        where: { role: 'ADMIN' },
        include: {
          user: { select: { email: true, emailNotifications: true } },
        },
      },
    },
  })

  for (const group of groups) {
    const daysSinceEvent = group.lastEventAt
      ? Math.floor((now.getTime() - group.lastEventAt.getTime()) / (1000 * 60 * 60 * 24))
      : null

    // Skip if not inactive
    if (daysSinceEvent === null || daysSinceEvent < group.inactivityThresholdDays) continue

    // Skip if we already nudged recently (within the threshold period)
    if (group.lastNudgeSentAt) {
      const daysSinceNudge = Math.floor(
        (now.getTime() - group.lastNudgeSentAt.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysSinceNudge < group.inactivityThresholdDays) continue
    }

    const admins = group.members.filter((m) => m.user.emailNotifications)
    if (admins.length === 0) continue

    const org = await getOrgSettings()
    const textPrimary = '#f1f5f9'
    const accentColor = '#16a0ac'
    const base = process.env.AUTH_URL || 'http://localhost:3000'

    const subject = `${group.name} hasn't had an event in ${daysSinceEvent} days`
    const content = `
      <h2 style="margin:0 0 12px;font-size:20px;color:${textPrimary};">
        ${group.name} has been quiet
      </h2>
      <p style="margin:0 0 20px;font-size:14px;color:${textPrimary};">
        It's been ${daysSinceEvent} days since the last event. Maybe it's time for something new?
      </p>
      <a href="${base}/events/new?groupId=${group.id}" style="display:inline-block;background-color:${accentColor};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        Create an Event
      </a>
    `

    const html = baseEmailHtml({ ...org, preheader: subject, content })

    await sendEmail({
      to: admins.map((a) => a.user.email),
      subject,
      html,
    })

    await prisma.group.update({
      where: { id: group.id },
      data: { lastNudgeSentAt: now },
    })

    nudgeCount++
  }

  return nudgeCount
}
```

- [ ] **Step 2: Update cron job to include instance generation and nudges**

In `src/app/api/cron/notifications/route.ts`, add imports and calls:

```typescript
import { sendEventReminders } from '@/lib/notifications/triggers'
import { sendInactivityNudges } from '@/lib/notifications/inactivity-nudge'
import { prisma } from '@/lib/prisma'
import { generateSeriesInstances } from '@/lib/actions/series'
```

In the try block, after `sendEventReminders()`, add:

```typescript
    // Generate upcoming recurring event instances
    const activeSeries = await prisma.eventSeries.findMany({
      where: { OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] },
      select: { id: true },
    })
    let instancesGenerated = 0
    for (const series of activeSeries) {
      instancesGenerated += await generateSeriesInstances(series.id, 8)
    }

    // Send inactivity nudges
    const nudgesCount = await sendInactivityNudges()
```

Update the response to include all counts:
```typescript
    return NextResponse.json({
      ok: true,
      reminders: remindersCount,
      instances: instancesGenerated,
      nudges: nudgesCount,
      timestamp: new Date().toISOString(),
    })
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/notifications/inactivity-nudge.ts src/app/api/cron/notifications/route.ts
git commit -m "feat: add inactivity nudges and series instance generation to cron"
```

---

### Task 9: End-to-End Verification

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Verify in browser**

1. **Google Places** — create a new event, type in the location field, see autocomplete suggestions (requires `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in .env). Falls back to plain text input without the key.
2. **Tags** — create a new event, add tags (create new ones inline), see them on the event detail page. Go to feed, filter by tag.
3. **Recurring events** — create an event with "Make this recurring" toggled on, set weekly recurrence. Check the feed — should see multiple future instances.
4. **Series delete** — click a recurring event, click Delete, see the modal with three options. Try "This event only".
5. **Inactivity nudges** — test via `curl http://localhost:3000/api/cron/notifications`
6. **Cron response** — should show reminders, instances, and nudges counts

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Phase 6 polish — all features implemented"
```
