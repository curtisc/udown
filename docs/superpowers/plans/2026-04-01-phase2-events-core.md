# Phase 2: Events Core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build event creation, the event feed, RSVP with guest counts, event detail pages, and edit/delete — making the app usable for its core purpose.

**Architecture:** Server actions for all mutations (create/update/delete events, RSVP). Server components for data fetching (feed, detail pages). Client components only for interactive elements (event form, RSVP button, guest picker). All events auto-assign to the default group (group selection comes in Phase 4).

**Tech Stack:** Next.js 16, TypeScript, Tailwind v4, Prisma v7 (PrismaPg adapter), Vitest

**Codebase notes for implementers:**
- Prisma v7 uses `PrismaPg` adapter — import `prisma` from `@/lib/prisma`
- Tailwind v4 — no `tailwind.config.ts`, theme extends via `@theme inline` in `globals.css`
- Next.js 16 — uses `proxy.ts` not `middleware.ts`
- CSS variables for theming: `var(--text-primary)`, `var(--bg-card)`, `var(--bg-surface)`, `var(--brand-accent)`, etc.
- Session available via `auth()` from `@/lib/auth` — returns `session.user.id`, `.name`, `.email`, `.image`
- Location is freeform text input for now (Google Places autocomplete is Phase 6)
- No tags, recurring events, or notifications in this phase

---

## File Map

**New files:**
```
src/lib/actions/events.ts          # Server actions: createEvent, updateEvent, deleteEvent
src/lib/actions/rsvps.ts           # Server actions: setRsvp, removeRsvp
src/lib/format.ts                  # Date/cost formatting utilities
src/__tests__/lib/format.test.ts   # Tests for formatting utilities
src/components/events/event-form.tsx    # Create/edit form (client component)
src/components/events/event-card.tsx    # Event card for the feed
src/components/events/rsvp-button.tsx   # RSVP toggle (client component)
src/components/events/attendee-list.tsx # Attendee avatars + counts
src/app/(app)/events/new/page.tsx       # Create event page
src/app/(app)/events/[id]/page.tsx      # Event detail page
src/app/(app)/events/[id]/edit/page.tsx # Edit event page
```

**Modified files:**
```
src/app/(app)/feed/page.tsx         # Replace placeholder with real feed
```

---

### Task 1: Formatting Utilities (TDD)

**Files:**
- Create: `src/lib/format.ts`, `src/__tests__/lib/format.test.ts`

- [ ] **Step 1: Write the failing tests**

Write to `src/__tests__/lib/format.test.ts`:

```typescript
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
      down: 4,       // 2 people (1+2 guests) + 1 person (1+0 guests)
      maybe: 2,      // 1 person + 1 guest
      notDown: 1,
    })
  })

  it('returns zeros for empty RSVPs', () => {
    expect(formatAttendeeCounts([])).toEqual({ down: 0, maybe: 0, notDown: 0 })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/lib/format.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Write to `src/lib/format.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/lib/format.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/__tests__/lib/format.test.ts
git commit -m "feat: add date, cost, and attendee formatting utilities"
```

---

### Task 2: Event Server Actions

**Files:**
- Create: `src/lib/actions/events.ts`

- [ ] **Step 1: Create event server actions**

Write to `src/lib/actions/events.ts`:

```typescript
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function createEvent(formData: FormData) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const defaultGroup = await prisma.group.findFirst({
    where: { isDefault: true },
  })
  if (!defaultGroup) throw new Error('No default group found')

  const title = formData.get('title') as string
  if (!title?.trim()) throw new Error('Title is required')

  const dateTimeStr = formData.get('dateTime') as string
  if (!dateTimeStr) throw new Error('Date and time are required')

  const endTimeStr = formData.get('endTime') as string
  const costStr = formData.get('estimatedCost') as string
  const capacityStr = formData.get('capacity') as string

  await prisma.event.create({
    data: {
      title: title.trim(),
      description: (formData.get('description') as string)?.trim() || null,
      dateTime: new Date(dateTimeStr),
      endTime: endTimeStr ? new Date(endTimeStr) : null,
      placeName: (formData.get('placeName') as string)?.trim() || null,
      placeAddress: (formData.get('placeAddress') as string)?.trim() || null,
      estimatedCost: costStr ? parseFloat(costStr) : null,
      capacity: capacityStr ? parseInt(capacityStr, 10) : null,
      groupId: defaultGroup.id,
      createdById: session.user.id,
    },
  })

  await prisma.group.update({
    where: { id: defaultGroup.id },
    data: { lastEventAt: new Date() },
  })

  revalidatePath('/feed')
  redirect('/feed')
}

export async function updateEvent(eventId: string, formData: FormData) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { group: true },
  })
  if (!event) throw new Error('Event not found')

  const canEdit = await checkEditPermission(session.user.id, event)
  if (!canEdit) throw new Error('Not authorized to edit this event')

  const title = formData.get('title') as string
  if (!title?.trim()) throw new Error('Title is required')

  const dateTimeStr = formData.get('dateTime') as string
  if (!dateTimeStr) throw new Error('Date and time are required')

  const endTimeStr = formData.get('endTime') as string
  const costStr = formData.get('estimatedCost') as string
  const capacityStr = formData.get('capacity') as string

  await prisma.event.update({
    where: { id: eventId },
    data: {
      title: title.trim(),
      description: (formData.get('description') as string)?.trim() || null,
      dateTime: new Date(dateTimeStr),
      endTime: endTimeStr ? new Date(endTimeStr) : null,
      placeName: (formData.get('placeName') as string)?.trim() || null,
      placeAddress: (formData.get('placeAddress') as string)?.trim() || null,
      estimatedCost: costStr ? parseFloat(costStr) : null,
      capacity: capacityStr ? parseInt(capacityStr, 10) : null,
    },
  })

  revalidatePath('/feed')
  revalidatePath(`/events/${eventId}`)
  redirect(`/events/${eventId}`)
}

export async function deleteEvent(eventId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const event = await prisma.event.findUnique({
    where: { id: eventId },
  })
  if (!event) throw new Error('Event not found')

  const canEdit = await checkEditPermission(session.user.id, event)
  if (!canEdit) throw new Error('Not authorized to delete this event')

  await prisma.event.delete({ where: { id: eventId } })

  revalidatePath('/feed')
  redirect('/feed')
}

async function checkEditPermission(
  userId: string,
  event: { createdById: string }
): Promise<boolean> {
  if (event.createdById === userId) return true

  // Org admins can edit any event
  const defaultGroup = await prisma.group.findFirst({
    where: { isDefault: true },
  })
  if (defaultGroup) {
    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId: defaultGroup.id } },
    })
    if (membership?.role === 'ADMIN') return true
  }

  return false
}
```

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/events.ts
git commit -m "feat: add event CRUD server actions"
```

---

### Task 3: RSVP Server Actions

**Files:**
- Create: `src/lib/actions/rsvps.ts`

- [ ] **Step 1: Create RSVP server actions**

Write to `src/lib/actions/rsvps.ts`:

```typescript
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function setRsvp(
  eventId: string,
  status: 'DOWN' | 'MAYBE' | 'NOT_DOWN',
  guestCount: number = 0
) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  await prisma.rSVP.upsert({
    where: {
      userId_eventId: { userId: session.user.id, eventId },
    },
    create: {
      userId: session.user.id,
      eventId,
      status,
      guestCount: status === 'NOT_DOWN' ? 0 : guestCount,
    },
    update: {
      status,
      guestCount: status === 'NOT_DOWN' ? 0 : guestCount,
    },
  })

  revalidatePath(`/events/${eventId}`)
  revalidatePath('/feed')
}

export async function removeRsvp(eventId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  await prisma.rSVP.deleteMany({
    where: { userId: session.user.id, eventId },
  })

  revalidatePath(`/events/${eventId}`)
  revalidatePath('/feed')
}

export async function updateGuestCount(eventId: string, guestCount: number) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const existing = await prisma.rSVP.findUnique({
    where: { userId_eventId: { userId: session.user.id, eventId } },
  })
  if (!existing) throw new Error('No RSVP found')

  await prisma.rSVP.update({
    where: { userId_eventId: { userId: session.user.id, eventId } },
    data: { guestCount },
  })

  revalidatePath(`/events/${eventId}`)
  revalidatePath('/feed')
}
```

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/rsvps.ts
git commit -m "feat: add RSVP server actions with guest count"
```

---

### Task 4: Event Form Component

**Files:**
- Create: `src/components/events/event-form.tsx`

- [ ] **Step 1: Create the event form**

Write to `src/components/events/event-form.tsx`:

```typescript
'use client'

type EventFormProps = {
  action: (formData: FormData) => Promise<void>
  defaultValues?: {
    title?: string
    description?: string | null
    dateTime?: string
    endTime?: string | null
    placeName?: string | null
    placeAddress?: string | null
    estimatedCost?: number | null
    capacity?: number | null
  }
  submitLabel: string
}

export function EventForm({ action, defaultValues, submitLabel }: EventFormProps) {
  return (
    <form action={action} className="space-y-4">
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
          Details
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={defaultValues?.description || ''}
          placeholder="What should people know?"
          className="mt-1 w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="dateTime" className="block text-sm font-medium text-[var(--text-primary)]">
            When? *
          </label>
          <input
            id="dateTime"
            name="dateTime"
            type="datetime-local"
            required
            defaultValue={defaultValues?.dateTime}
            className="mt-1 w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)] focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
          />
        </div>
        <div>
          <label htmlFor="endTime" className="block text-sm font-medium text-[var(--text-primary)]">
            Until
          </label>
          <input
            id="endTime"
            name="endTime"
            type="datetime-local"
            defaultValue={defaultValues?.endTime || ''}
            className="mt-1 w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)] focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
          />
        </div>
      </div>

      <div>
        <label htmlFor="placeName" className="block text-sm font-medium text-[var(--text-primary)]">
          Where?
        </label>
        <input
          id="placeName"
          name="placeName"
          type="text"
          defaultValue={defaultValues?.placeName || ''}
          placeholder="Dolores Park, My apartment, etc."
          className="mt-1 w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
        />
      </div>

      <div>
        <label htmlFor="placeAddress" className="block text-sm font-medium text-[var(--text-primary)]">
          Address
        </label>
        <input
          id="placeAddress"
          name="placeAddress"
          type="text"
          defaultValue={defaultValues?.placeAddress || ''}
          placeholder="123 Main St"
          className="mt-1 w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
        />
      </div>

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

      <button
        type="submit"
        className="w-full rounded-lg bg-[var(--brand-accent)] px-4 py-3 font-semibold text-white transition-opacity hover:opacity-90"
      >
        {submitLabel}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/events/event-form.tsx
git commit -m "feat: add reusable event form component"
```

---

### Task 5: Create Event Page

**Files:**
- Create: `src/app/(app)/events/new/page.tsx`

- [ ] **Step 1: Create the new event page**

Write to `src/app/(app)/events/new/page.tsx`:

```typescript
import { createEvent } from '@/lib/actions/events'
import { EventForm } from '@/components/events/event-form'
import Link from 'next/link'

export default function NewEventPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">New Event</h2>
        <Link
          href="/feed"
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Cancel
        </Link>
      </div>
      <EventForm action={createEvent} submitLabel="Create Event" />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/events/
git commit -m "feat: add create event page"
```

---

### Task 6: Attendee List Component

**Files:**
- Create: `src/components/events/attendee-list.tsx`

- [ ] **Step 1: Create the attendee list**

Write to `src/components/events/attendee-list.tsx`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/events/attendee-list.tsx
git commit -m "feat: add attendee list and avatar row components"
```

---

### Task 7: Event Card Component

**Files:**
- Create: `src/components/events/event-card.tsx`

- [ ] **Step 1: Create the event card**

Write to `src/components/events/event-card.tsx`:

```typescript
import Link from 'next/link'
import { formatEventDate, formatEventTime, formatCost, formatAttendeeCounts } from '@/lib/format'
import { AttendeeList } from './attendee-list'

type EventCardProps = {
  event: {
    id: string
    title: string
    dateTime: Date
    endTime: Date | null
    placeName: string | null
    estimatedCost: number | null
    capacity: number | null
    rsvps: Array<{
      user: { id: string; name: string | null; image: string | null }
      status: 'DOWN' | 'MAYBE' | 'NOT_DOWN'
      guestCount: number
    }>
  }
  currentUserId: string
}

export function EventCard({ event, currentUserId }: EventCardProps) {
  const counts = formatAttendeeCounts(event.rsvps)
  const cost = formatCost(event.estimatedCost)
  const userRsvp = event.rsvps.find((r) => r.user.id === currentUserId)

  return (
    <Link
      href={`/events/${event.id}`}
      className="block rounded-xl bg-[var(--bg-card)] p-4 transition-colors hover:bg-[var(--bg-surface)]"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-[var(--text-primary)] truncate">
            {event.title}
          </h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {formatEventDate(event.dateTime)} at {formatEventTime(event.dateTime)}
            {event.endTime && ` - ${formatEventTime(event.endTime)}`}
          </p>
          {event.placeName && (
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
              {event.placeName}
            </p>
          )}
        </div>
        <div className="ml-3 flex flex-col items-end gap-1">
          {cost && (
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              {cost}/person
            </span>
          )}
          {userRsvp && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                userRsvp.status === 'DOWN'
                  ? 'bg-green-500/20 text-green-400'
                  : userRsvp.status === 'MAYBE'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-red-500/20 text-red-400'
              }`}
            >
              {userRsvp.status === 'DOWN'
                ? "I'm Down"
                : userRsvp.status === 'MAYBE'
                  ? 'Maybe'
                  : "Can't Make It"}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <AttendeeList rsvps={event.rsvps} compact />
        <div className="flex gap-2 text-xs text-[var(--text-secondary)]">
          {counts.down > 0 && <span>{counts.down} down</span>}
          {counts.maybe > 0 && <span>{counts.maybe} maybe</span>}
          {event.capacity && (
            <span>/ {event.capacity} max</span>
          )}
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/events/event-card.tsx
git commit -m "feat: add event card component for feed"
```

---

### Task 8: Event Feed Page

**Files:**
- Modify: `src/app/(app)/feed/page.tsx`

- [ ] **Step 1: Replace placeholder with real feed**

Replace `src/app/(app)/feed/page.tsx`:

```typescript
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EventCard } from '@/components/events/event-card'
import Link from 'next/link'

export default async function FeedPage() {
  const session = await auth()
  if (!session?.user) return null

  const now = new Date()

  const upcomingEvents = await prisma.event.findMany({
    where: {
      dateTime: { gte: now },
      group: {
        members: { some: { userId: session.user.id } },
      },
    },
    include: {
      rsvps: {
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
      },
    },
    orderBy: { dateTime: 'asc' },
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Upcoming</h2>
        <Link
          href="/events/new"
          className="rounded-lg bg-[var(--brand-accent)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          New Event
        </Link>
      </div>

      {upcomingEvents.length > 0 ? (
        <div className="space-y-3">
          {upcomingEvents.map((event) => (
            <EventCard
              key={event.id}
              event={{
                ...event,
                estimatedCost: event.estimatedCost ? Number(event.estimatedCost) : null,
                rsvps: event.rsvps.map((r) => ({
                  ...r,
                  status: r.status as 'DOWN' | 'MAYBE' | 'NOT_DOWN',
                })),
              }}
              currentUserId={session.user.id}
            />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center">
          <h3 className="text-lg font-medium text-[var(--text-primary)]">
            No events yet
          </h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Be the first to post one!
          </p>
          <Link
            href="/events/new"
            className="mt-4 inline-block rounded-lg bg-[var(--brand-accent)] px-6 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Create an Event
          </Link>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/feed/page.tsx
git commit -m "feat: replace feed placeholder with real event feed"
```

---

### Task 9: RSVP Button Component

**Files:**
- Create: `src/components/events/rsvp-button.tsx`

- [ ] **Step 1: Create the RSVP button with guest picker**

Write to `src/components/events/rsvp-button.tsx`:

```typescript
'use client'

import { useTransition, useState } from 'react'
import { setRsvp, removeRsvp, updateGuestCount } from '@/lib/actions/rsvps'

type RsvpButtonProps = {
  eventId: string
  currentStatus: 'DOWN' | 'MAYBE' | 'NOT_DOWN' | null
  currentGuestCount: number
}

const statuses = [
  { value: 'DOWN' as const, label: "I'm Down", activeClass: 'bg-green-500 text-white' },
  { value: 'MAYBE' as const, label: 'Maybe', activeClass: 'bg-yellow-500 text-white' },
  { value: 'NOT_DOWN' as const, label: "Can't Make It", activeClass: 'bg-red-500/80 text-white' },
]

export function RsvpButton({ eventId, currentStatus, currentGuestCount }: RsvpButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [guestCount, setGuestCount] = useState(currentGuestCount)

  function handleStatusClick(status: 'DOWN' | 'MAYBE' | 'NOT_DOWN') {
    startTransition(async () => {
      if (status === currentStatus) {
        await removeRsvp(eventId)
      } else {
        await setRsvp(eventId, status, status === 'NOT_DOWN' ? 0 : guestCount)
      }
    })
  }

  function handleGuestChange(delta: number) {
    const newCount = Math.max(0, guestCount + delta)
    setGuestCount(newCount)
    if (currentStatus && currentStatus !== 'NOT_DOWN') {
      startTransition(async () => {
        await updateGuestCount(eventId, newCount)
      })
    }
  }

  const showGuestPicker = currentStatus === 'DOWN' || currentStatus === 'MAYBE'

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {statuses.map((s) => (
          <button
            key={s.value}
            onClick={() => handleStatusClick(s.value)}
            disabled={isPending}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              currentStatus === s.value
                ? s.activeClass
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            } ${isPending ? 'opacity-50' : ''}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {showGuestPicker && (
        <div className="flex items-center gap-3 rounded-lg bg-[var(--bg-surface)] px-3 py-2">
          <span className="text-sm text-[var(--text-secondary)]">Bringing anyone?</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleGuestChange(-1)}
              disabled={isPending || guestCount === 0}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-card)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-primary)] disabled:opacity-30"
            >
              -
            </button>
            <span className="w-6 text-center text-sm font-medium text-[var(--text-primary)]">
              {guestCount}
            </span>
            <button
              onClick={() => handleGuestChange(1)}
              disabled={isPending}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-card)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-primary)]"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/events/rsvp-button.tsx
git commit -m "feat: add RSVP button with guest picker"
```

---

### Task 10: Event Detail Page

**Files:**
- Create: `src/app/(app)/events/[id]/page.tsx`

- [ ] **Step 1: Create the event detail page**

Write to `src/app/(app)/events/[id]/page.tsx`:

```typescript
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatEventDate, formatEventTime, formatCost } from '@/lib/format'
import { RsvpButton } from '@/components/events/rsvp-button'
import { AttendeeList } from '@/components/events/attendee-list'
import { deleteEvent } from '@/lib/actions/events'

type Props = {
  params: Promise<{ id: string }>
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) return null

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
      rsvps: {
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
      },
    },
  })

  if (!event) notFound()

  const userRsvp = event.rsvps.find((r) => r.user.id === session.user.id)
  const isCreator = event.createdById === session.user.id

  // Check if user is org admin
  const defaultGroup = await prisma.group.findFirst({ where: { isDefault: true } })
  let isOrgAdmin = false
  if (defaultGroup) {
    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: session.user.id, groupId: defaultGroup.id } },
    })
    isOrgAdmin = membership?.role === 'ADMIN'
  }
  const canEdit = isCreator || isOrgAdmin

  const cost = formatCost(event.estimatedCost ? Number(event.estimatedCost) : null)

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/feed"
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          &larr; Back to feed
        </Link>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">{event.title}</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Posted by {event.createdBy.name || 'Anonymous'}
        </p>
      </div>

      <div className="space-y-2 rounded-xl bg-[var(--bg-card)] p-4">
        <div className="flex items-center gap-2 text-[var(--text-primary)]">
          <span className="text-sm font-medium">
            {formatEventDate(event.dateTime)} at {formatEventTime(event.dateTime)}
            {event.endTime && ` - ${formatEventTime(event.endTime)}`}
          </span>
        </div>
        {event.placeName && (
          <p className="text-sm text-[var(--text-secondary)]">
            {event.placeName}
            {event.placeAddress && ` — ${event.placeAddress}`}
          </p>
        )}
        {cost && (
          <p className="text-sm text-[var(--text-secondary)]">
            ~{cost}/person
          </p>
        )}
        {event.capacity && (
          <p className="text-sm text-[var(--text-secondary)]">
            Max {event.capacity} people
          </p>
        )}
      </div>

      {event.description && (
        <p className="whitespace-pre-wrap text-[var(--text-primary)]">
          {event.description}
        </p>
      )}

      <div className="rounded-xl bg-[var(--bg-card)] p-4">
        <RsvpButton
          eventId={event.id}
          currentStatus={userRsvp?.status as 'DOWN' | 'MAYBE' | 'NOT_DOWN' | null ?? null}
          currentGuestCount={userRsvp?.guestCount ?? 0}
        />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Who&apos;s coming?</h3>
        <AttendeeList
          rsvps={event.rsvps.map((r) => ({
            ...r,
            status: r.status as 'DOWN' | 'MAYBE' | 'NOT_DOWN',
          }))}
        />
      </div>

      {canEdit && (
        <div className="flex gap-3 border-t border-[var(--bg-surface)] pt-4">
          <Link
            href={`/events/${event.id}/edit`}
            className="rounded-lg bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-card)]"
          >
            Edit
          </Link>
          <form
            action={async () => {
              'use server'
              await deleteEvent(event.id)
            }}
          >
            <button
              type="submit"
              className="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30"
            >
              Delete
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/events/\[id\]/page.tsx
git commit -m "feat: add event detail page with RSVP and attendees"
```

---

### Task 11: Edit Event Page

**Files:**
- Create: `src/app/(app)/events/[id]/edit/page.tsx`

- [ ] **Step 1: Create the edit event page**

Write to `src/app/(app)/events/[id]/edit/page.tsx`:

```typescript
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { EventForm } from '@/components/events/event-form'
import { updateEvent } from '@/lib/actions/events'

type Props = {
  params: Promise<{ id: string }>
}

function toDateTimeLocal(date: Date): string {
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

export default async function EditEventPage({ params }: Props) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const event = await prisma.event.findUnique({ where: { id } })
  if (!event) notFound()

  // Check permissions: creator or org admin
  let canEdit = event.createdById === session.user.id
  if (!canEdit) {
    const defaultGroup = await prisma.group.findFirst({ where: { isDefault: true } })
    if (defaultGroup) {
      const membership = await prisma.groupMember.findUnique({
        where: { userId_groupId: { userId: session.user.id, groupId: defaultGroup.id } },
      })
      canEdit = membership?.role === 'ADMIN'
    }
  }
  if (!canEdit) redirect(`/events/${id}`)

  const boundUpdateEvent = updateEvent.bind(null, event.id)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Edit Event</h2>
        <Link
          href={`/events/${event.id}`}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Cancel
        </Link>
      </div>
      <EventForm
        action={boundUpdateEvent}
        submitLabel="Save Changes"
        defaultValues={{
          title: event.title,
          description: event.description,
          dateTime: toDateTimeLocal(event.dateTime),
          endTime: event.endTime ? toDateTimeLocal(event.endTime) : null,
          placeName: event.placeName,
          placeAddress: event.placeAddress,
          estimatedCost: event.estimatedCost ? Number(event.estimatedCost) : null,
          capacity: event.capacity,
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/events/\[id\]/edit/
git commit -m "feat: add edit event page"
```

---

### Task 12: End-to-End Verification

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: All tests pass (format tests + whitelist + provider config).

- [ ] **Step 2: Start dev server and verify**

```bash
npm run dev
```

Open `http://localhost:3000`. Verify:

1. **Feed page**: Shows "No events yet" with "Create an Event" button
2. **Create event**: Click "New Event", fill in title + date/time + optional fields, submit. Should redirect to feed showing the new event card.
3. **Event card**: Shows title, date, time, location, cost. Links to detail page.
4. **Event detail**: Shows full event info, RSVP buttons, attendee list, edit/delete buttons.
5. **RSVP**: Click "I'm Down" — button highlights green, guest picker appears. Add guests. Click "Maybe" — switches to yellow. Click same button again — RSVP removed.
6. **Edit event**: Click Edit, change title, save. Should update.
7. **Delete event**: Click Delete, event removed, redirected to feed.

- [ ] **Step 3: Verify type checking**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: complete Phase 2 events core"
```

---

## Notes for Phase 3

Phase 3 (Notifications) builds on this:
- New event → notify group members via email
- Event updated → notify RSVP'd users
- Event reminder → 24hr before, notify DOWN users
- RSVP milestone → notify when threshold reached
