# Phase 3: Notifications — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build email notifications for events (new, updated, reminders, RSVP milestones) with user-configurable preferences and a Vercel Cron job for scheduled reminders.

**Architecture:** Resend for email delivery. Dark-themed, branded HTML email templates. Notifications fire inline from server actions (new event, update, RSVP milestone). Event reminders dispatched hourly via Vercel Cron. User notification preferences stored per-group with global email toggle. All notification sends are fire-and-forget wrapped in `.catch(console.error)` to avoid blocking user actions.

**Tech Stack:** Resend, Next.js 16, Prisma v7, Vercel Cron, Vitest

**Codebase notes for implementers:**
- Prisma v7 with `PrismaPg` adapter — `prisma` from `@/lib/prisma`
- Tailwind v4 — theme via CSS vars, `@variant dark`, `@theme inline`
- Next.js 16 — `proxy.ts` not middleware, `params` is `Promise`
- `auth()` from `@/lib/auth` — `session.user.id`, `.name`, `.email`, `.image`
- `getOrgSettings()` from `@/lib/org-settings` — returns org name, logo, colors, fromEmail
- Server actions in `src/lib/actions/events.ts` and `rsvps.ts` — these get notification calls added
- If `RESEND_API_KEY` is not set, notifications are logged to console instead of sent

---

## File Map

**New files:**
```
src/lib/notifications/send-email.ts       # Resend API wrapper
src/lib/notifications/templates.ts        # All email templates (base layout + per-type)
src/lib/notifications/triggers.ts         # Notification trigger functions
src/lib/notifications/preferences.ts      # Query who to notify
src/__tests__/lib/notifications/templates.test.ts  # Template output tests
src/__tests__/lib/notifications/preferences.test.ts # Preference logic tests
src/lib/actions/settings.ts               # Server actions for preference updates
src/app/(app)/settings/page.tsx           # User settings page
src/app/api/cron/notifications/route.ts   # Cron job endpoint
vercel.json                               # Cron schedule config
```

**Modified files:**
```
src/lib/actions/events.ts     # Add notification triggers to createEvent, updateEvent
src/lib/actions/rsvps.ts      # Add RSVP milestone trigger to setRsvp
```

---

### Task 1: Resend Email Sender

**Files:**
- Create: `src/lib/notifications/send-email.ts`

- [ ] **Step 1: Create the email sender utility**

Write to `src/lib/notifications/send-email.ts`:

```typescript
import { Resend } from 'resend'
import { getOrgSettings } from '@/lib/org-settings'

let resend: Resend | null = null

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY)
  return resend
}

export async function sendEmail(options: {
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
}): Promise<void> {
  const client = getResendClient()
  const org = await getOrgSettings()
  const from = org.fromEmail
    ? `${org.fromName || org.orgName} <${org.fromEmail}>`
    : process.env.RESEND_FROM_EMAIL
      ? `${org.orgName} <${process.env.RESEND_FROM_EMAIL}>`
      : null

  if (!client || !from) {
    console.log(
      `[Email${!client ? ' - no API key' : ' - no from address'}]`,
      `To: ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`,
      `Subject: ${options.subject}`
    )
    return
  }

  const recipients = Array.isArray(options.to) ? options.to : [options.to]

  for (const to of recipients) {
    try {
      await client.emails.send({
        from,
        to,
        subject: options.subject,
        html: options.html,
        replyTo: options.replyTo,
      })
    } catch (error) {
      console.error(`Failed to send email to ${to}:`, error)
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/notifications/send-email.ts
git commit -m "feat: add Resend email sender utility"
```

---

### Task 2: Email Templates (TDD)

**Files:**
- Create: `src/lib/notifications/templates.ts`, `src/__tests__/lib/notifications/templates.test.ts`

- [ ] **Step 1: Write the failing tests**

Write to `src/__tests__/lib/notifications/templates.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  baseEmailHtml,
  newEventEmailContent,
  eventUpdateEmailContent,
  eventReminderEmailContent,
  rsvpMilestoneEmailContent,
} from '@/lib/notifications/templates'

const orgDefaults = {
  orgName: 'Test Org',
  orgLogo: null,
  primaryColor: '#003262',
  accentColor: '#16a0ac',
}

describe('baseEmailHtml', () => {
  it('wraps content in branded dark-themed layout', () => {
    const html = baseEmailHtml({
      ...orgDefaults,
      preheader: 'Test preheader',
      content: '<p>Hello world</p>',
    })
    expect(html).toContain('Test Org')
    expect(html).toContain('Hello world')
    expect(html).toContain('#0f0f1a') // dark background
    expect(html).toContain('#16a0ac') // accent color
    expect(html).toContain('Test preheader')
  })

  it('includes org logo when provided', () => {
    const html = baseEmailHtml({
      ...orgDefaults,
      orgLogo: 'https://example.com/logo.png',
      preheader: '',
      content: '<p>Test</p>',
    })
    expect(html).toContain('https://example.com/logo.png')
  })
})

describe('newEventEmailContent', () => {
  it('returns subject and content with event details', () => {
    const result = newEventEmailContent({
      title: 'Board Game Night',
      dateTime: new Date('2026-04-15T19:00:00'),
      placeName: 'My Place',
      estimatedCost: 10,
      eventUrl: 'https://app.com/events/123',
      creatorName: 'Alice',
    })
    expect(result.subject).toContain('Board Game Night')
    expect(result.content).toContain('Board Game Night')
    expect(result.content).toContain('My Place')
    expect(result.content).toContain('$10')
    expect(result.content).toContain('https://app.com/events/123')
    expect(result.content).toContain('Alice')
  })
})

describe('eventUpdateEmailContent', () => {
  it('lists what changed', () => {
    const result = eventUpdateEmailContent({
      title: 'Park Hangout',
      changes: ['Time changed', 'Location changed'],
      eventUrl: 'https://app.com/events/456',
    })
    expect(result.subject).toContain('updated')
    expect(result.content).toContain('Time changed')
    expect(result.content).toContain('Location changed')
  })
})

describe('eventReminderEmailContent', () => {
  it('includes tomorrow reminder details', () => {
    const result = eventReminderEmailContent({
      title: 'Hiking Trip',
      dateTime: new Date('2026-04-15T09:00:00'),
      placeName: 'Trailhead',
      eventUrl: 'https://app.com/events/789',
    })
    expect(result.subject).toContain('Tomorrow')
    expect(result.content).toContain('Hiking Trip')
    expect(result.content).toContain('Trailhead')
  })
})

describe('rsvpMilestoneEmailContent', () => {
  it('shows the milestone count', () => {
    const result = rsvpMilestoneEmailContent({
      title: 'Game Night',
      count: 10,
      eventUrl: 'https://app.com/events/101',
    })
    expect(result.subject).toContain('10')
    expect(result.content).toContain('10')
    expect(result.content).toContain('Game Night')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/lib/notifications/templates.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Write to `src/lib/notifications/templates.ts`:

```typescript
import { formatEventDate, formatEventTime, formatCost } from '@/lib/format'

type OrgBranding = {
  orgName: string
  orgLogo: string | null
  primaryColor: string
  accentColor: string
}

export function baseEmailHtml(options: OrgBranding & {
  preheader: string
  content: string
}): string {
  const { orgName, orgLogo, primaryColor, accentColor, preheader, content } = options
  const bgDark = '#0f0f1a'
  const bgCard = '#1a1a2e'
  const textPrimary = '#f1f5f9'
  const textSecondary = '#94a3b8'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${orgName}</title>
</head>
<body style="margin:0;padding:0;background-color:${bgDark};font-family:Arial,Helvetica,sans-serif;">
  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${bgDark};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
          <!-- Logo / Org Name -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              ${orgLogo
                ? `<img src="${orgLogo}" alt="${orgName}" height="48" style="height:48px;width:auto;" />`
                : `<span style="font-size:20px;font-weight:bold;color:${accentColor};">${orgName}</span>`
              }
            </td>
          </tr>
          <!-- Content Card -->
          <tr>
            <td style="background-color:${bgCard};border-radius:12px;padding:24px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <span style="font-size:12px;color:${textSecondary};">
                Sent by ${orgName} via uDown
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

type EmailContent = { subject: string; content: string }

export function newEventEmailContent(event: {
  title: string
  dateTime: Date
  placeName: string | null
  estimatedCost: number | null
  eventUrl: string
  creatorName: string
}): EmailContent {
  const cost = formatCost(event.estimatedCost)
  const textPrimary = '#f1f5f9'
  const textSecondary = '#94a3b8'
  const accentColor = '#16a0ac'

  return {
    subject: `New event: ${event.title}`,
    content: `
      <h2 style="margin:0 0 4px;font-size:20px;color:${textPrimary};">${event.title}</h2>
      <p style="margin:0 0 16px;font-size:14px;color:${textSecondary};">
        Posted by ${event.creatorName}
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        <tr>
          <td style="padding:4px 0;font-size:14px;color:${textPrimary};">
            ${formatEventDate(event.dateTime)} at ${formatEventTime(event.dateTime)}
          </td>
        </tr>
        ${event.placeName ? `<tr><td style="padding:4px 0;font-size:14px;color:${textSecondary};">${event.placeName}</td></tr>` : ''}
        ${cost ? `<tr><td style="padding:4px 0;font-size:14px;color:${textSecondary};">~${cost}/person</td></tr>` : ''}
      </table>
      <a href="${event.eventUrl}" style="display:inline-block;background-color:${accentColor};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        Check it out
      </a>
    `,
  }
}

export function eventUpdateEmailContent(event: {
  title: string
  changes: string[]
  eventUrl: string
}): EmailContent {
  const textPrimary = '#f1f5f9'
  const textSecondary = '#94a3b8'
  const accentColor = '#16a0ac'

  return {
    subject: `${event.title} was updated`,
    content: `
      <h2 style="margin:0 0 12px;font-size:20px;color:${textPrimary};">${event.title} was updated</h2>
      <ul style="margin:0 0 20px;padding-left:20px;">
        ${event.changes.map((c) => `<li style="padding:4px 0;font-size:14px;color:${textSecondary};">${c}</li>`).join('')}
      </ul>
      <a href="${event.eventUrl}" style="display:inline-block;background-color:${accentColor};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        View Event
      </a>
    `,
  }
}

export function eventReminderEmailContent(event: {
  title: string
  dateTime: Date
  placeName: string | null
  eventUrl: string
}): EmailContent {
  const textPrimary = '#f1f5f9'
  const textSecondary = '#94a3b8'
  const accentColor = '#16a0ac'

  return {
    subject: `Tomorrow: ${event.title}`,
    content: `
      <h2 style="margin:0 0 12px;font-size:20px;color:${textPrimary};">Tomorrow: ${event.title}</h2>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        <tr>
          <td style="padding:4px 0;font-size:14px;color:${textPrimary};">
            ${formatEventTime(event.dateTime)}
          </td>
        </tr>
        ${event.placeName ? `<tr><td style="padding:4px 0;font-size:14px;color:${textSecondary};">${event.placeName}</td></tr>` : ''}
      </table>
      <a href="${event.eventUrl}" style="display:inline-block;background-color:${accentColor};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        View Event
      </a>
    `,
  }
}

export function rsvpMilestoneEmailContent(event: {
  title: string
  count: number
  eventUrl: string
}): EmailContent {
  const textPrimary = '#f1f5f9'
  const accentColor = '#16a0ac'

  return {
    subject: `${event.count} people are down for ${event.title}!`,
    content: `
      <h2 style="margin:0 0 12px;font-size:20px;color:${textPrimary};">
        ${event.count} people are down for ${event.title}!
      </h2>
      <a href="${event.eventUrl}" style="display:inline-block;background-color:${accentColor};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        See who&apos;s coming
      </a>
    `,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/lib/notifications/templates.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/templates.ts src/__tests__/lib/notifications/templates.test.ts
git commit -m "feat: add branded dark-themed email templates"
```

---

### Task 3: Notification Preferences Helper (TDD)

**Files:**
- Create: `src/lib/notifications/preferences.ts`, `src/__tests__/lib/notifications/preferences.test.ts`

- [ ] **Step 1: Write the failing tests**

Write to `src/__tests__/lib/notifications/preferences.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { filterNotifiableUsers } from '@/lib/notifications/preferences'

type UserPref = {
  userId: string
  email: string
  emailNotifications: boolean
  pref: { newEvents: boolean; eventUpdates: boolean; eventReminders: boolean; rsvpMilestones: boolean } | null
}

describe('filterNotifiableUsers', () => {
  const users: UserPref[] = [
    {
      userId: '1', email: 'a@test.com', emailNotifications: true,
      pref: { newEvents: true, eventUpdates: true, eventReminders: true, rsvpMilestones: true },
    },
    {
      userId: '2', email: 'b@test.com', emailNotifications: true,
      pref: { newEvents: false, eventUpdates: true, eventReminders: true, rsvpMilestones: true },
    },
    {
      userId: '3', email: 'c@test.com', emailNotifications: false,
      pref: { newEvents: true, eventUpdates: true, eventReminders: true, rsvpMilestones: true },
    },
    {
      userId: '4', email: 'd@test.com', emailNotifications: true,
      pref: null, // no per-group prefs = use defaults (all true)
    },
  ]

  it('filters by global email enabled AND per-group newEvents', () => {
    const result = filterNotifiableUsers(users, 'newEvents')
    expect(result.map((u) => u.userId)).toEqual(['1', '4'])
  })

  it('filters by eventUpdates', () => {
    const result = filterNotifiableUsers(users, 'eventUpdates')
    expect(result.map((u) => u.userId)).toEqual(['1', '2', '4'])
  })

  it('excludes users with global email off regardless of per-group pref', () => {
    const result = filterNotifiableUsers(users, 'eventReminders')
    expect(result.map((u) => u.userId)).not.toContain('3')
  })

  it('treats missing prefs as all-true (defaults)', () => {
    const result = filterNotifiableUsers(users, 'rsvpMilestones')
    expect(result.map((u) => u.userId)).toContain('4')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/lib/notifications/preferences.test.ts
```

- [ ] **Step 3: Write the implementation**

Write to `src/lib/notifications/preferences.ts`:

```typescript
import { prisma } from '@/lib/prisma'

type NotificationType = 'newEvents' | 'eventUpdates' | 'eventReminders' | 'rsvpMilestones'

type UserWithPref = {
  userId: string
  email: string
  emailNotifications: boolean
  pref: {
    newEvents: boolean
    eventUpdates: boolean
    eventReminders: boolean
    rsvpMilestones: boolean
  } | null
}

export function filterNotifiableUsers(
  users: UserWithPref[],
  type: NotificationType
): UserWithPref[] {
  return users.filter((u) => {
    if (!u.emailNotifications) return false
    if (!u.pref) return true // no per-group pref = defaults (all true)
    return u.pref[type]
  })
}

export async function getGroupMembersWithPrefs(
  groupId: string,
  excludeUserId?: string
): Promise<UserWithPref[]> {
  const members = await prisma.groupMember.findMany({
    where: {
      groupId,
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          emailNotifications: true,
          notificationPrefs: {
            where: { groupId },
            select: {
              newEvents: true,
              eventUpdates: true,
              eventReminders: true,
              rsvpMilestones: true,
            },
          },
        },
      },
    },
  })

  return members.map((m) => ({
    userId: m.user.id,
    email: m.user.email,
    emailNotifications: m.user.emailNotifications,
    pref: m.user.notificationPrefs[0] || null,
  }))
}

export async function getRsvpdUsersWithPrefs(
  eventId: string,
  groupId: string,
  statuses: ('DOWN' | 'MAYBE')[]
): Promise<UserWithPref[]> {
  const rsvps = await prisma.rSVP.findMany({
    where: {
      eventId,
      status: { in: statuses },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          emailNotifications: true,
          notificationPrefs: {
            where: { groupId },
            select: {
              newEvents: true,
              eventUpdates: true,
              eventReminders: true,
              rsvpMilestones: true,
            },
          },
        },
      },
    },
  })

  return rsvps.map((r) => ({
    userId: r.user.id,
    email: r.user.email,
    emailNotifications: r.user.emailNotifications,
    pref: r.user.notificationPrefs[0] || null,
  }))
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/__tests__/lib/notifications/preferences.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/preferences.ts src/__tests__/lib/notifications/preferences.test.ts
git commit -m "feat: add notification preference filtering logic"
```

---

### Task 4: Notification Triggers

**Files:**
- Create: `src/lib/notifications/triggers.ts`

- [ ] **Step 1: Create the trigger functions**

Write to `src/lib/notifications/triggers.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import { getOrgSettings } from '@/lib/org-settings'
import { sendEmail } from './send-email'
import {
  baseEmailHtml,
  newEventEmailContent,
  eventUpdateEmailContent,
  eventReminderEmailContent,
  rsvpMilestoneEmailContent,
} from './templates'
import {
  filterNotifiableUsers,
  getGroupMembersWithPrefs,
  getRsvpdUsersWithPrefs,
} from './preferences'

function getEventUrl(eventId: string): string {
  const base = process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
  return `${base}/events/${eventId}`
}

export async function notifyNewEvent(eventId: string): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      createdBy: { select: { name: true, email: true } },
      group: { select: { id: true, owner: { select: { email: true } } } },
    },
  })
  if (!event) return

  const org = await getOrgSettings()
  const users = await getGroupMembersWithPrefs(event.groupId, event.createdById)
  const notifiable = filterNotifiableUsers(users, 'newEvents')
  if (notifiable.length === 0) return

  const { subject, content } = newEventEmailContent({
    title: event.title,
    dateTime: event.dateTime,
    placeName: event.placeName,
    estimatedCost: event.estimatedCost ? Number(event.estimatedCost) : null,
    eventUrl: getEventUrl(eventId),
    creatorName: event.createdBy.name || 'Someone',
  })

  const html = baseEmailHtml({ ...org, preheader: subject, content })

  await sendEmail({
    to: notifiable.map((u) => u.email),
    subject,
    html,
    replyTo: event.group.owner.email,
  })
}

export async function notifyEventUpdate(
  eventId: string,
  changes: string[]
): Promise<void> {
  if (changes.length === 0) return

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      group: { select: { id: true, owner: { select: { email: true } } } },
    },
  })
  if (!event) return

  const org = await getOrgSettings()
  const users = await getRsvpdUsersWithPrefs(eventId, event.groupId, ['DOWN', 'MAYBE'])
  const notifiable = filterNotifiableUsers(users, 'eventUpdates')
  if (notifiable.length === 0) return

  const { subject, content } = eventUpdateEmailContent({
    title: event.title,
    changes,
    eventUrl: getEventUrl(eventId),
  })

  const html = baseEmailHtml({ ...org, preheader: subject, content })

  await sendEmail({
    to: notifiable.map((u) => u.email),
    subject,
    html,
    replyTo: event.group.owner.email,
  })
}

export async function notifyRsvpMilestone(eventId: string): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      group: { select: { id: true } },
      rsvps: { where: { status: 'DOWN' }, select: { guestCount: true } },
    },
  })
  if (!event) return

  const totalDown = event.rsvps.reduce((sum, r) => sum + 1 + r.guestCount, 0)
  const milestones = [5, 10, 15, 20, 25, 50]
  const hitMilestone = milestones.find((m) => totalDown === m)
  if (!hitMilestone) return

  const org = await getOrgSettings()
  const users = await getGroupMembersWithPrefs(event.groupId)
  const notifiable = filterNotifiableUsers(users, 'rsvpMilestones')
  if (notifiable.length === 0) return

  const { subject, content } = rsvpMilestoneEmailContent({
    title: event.title,
    count: hitMilestone,
    eventUrl: getEventUrl(eventId),
  })

  const html = baseEmailHtml({ ...org, preheader: subject, content })

  await sendEmail({
    to: notifiable.map((u) => u.email),
    subject,
    html,
  })
}

export async function sendEventReminders(): Promise<number> {
  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000)

  const events = await prisma.event.findMany({
    where: {
      dateTime: { gte: in24h, lt: in25h },
      reminderSentAt: null,
    },
    include: {
      group: { select: { id: true } },
    },
  })

  let sentCount = 0

  for (const event of events) {
    const users = await getRsvpdUsersWithPrefs(event.id, event.groupId, ['DOWN'])
    const notifiable = filterNotifiableUsers(users, 'eventReminders')

    if (notifiable.length > 0) {
      const org = await getOrgSettings()
      const { subject, content } = eventReminderEmailContent({
        title: event.title,
        dateTime: event.dateTime,
        placeName: event.placeName,
        eventUrl: getEventUrl(event.id),
      })
      const html = baseEmailHtml({ ...org, preheader: subject, content })

      await sendEmail({
        to: notifiable.map((u) => u.email),
        subject,
        html,
      })
      sentCount++
    }

    await prisma.event.update({
      where: { id: event.id },
      data: { reminderSentAt: now },
    })
  }

  return sentCount
}
```

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/notifications/triggers.ts
git commit -m "feat: add notification trigger functions"
```

---

### Task 5: Hook Notifications into Server Actions

**Files:**
- Modify: `src/lib/actions/events.ts`, `src/lib/actions/rsvps.ts`

- [ ] **Step 1: Add notification triggers to event actions**

In `src/lib/actions/events.ts`, add import at the top:

```typescript
import { notifyNewEvent, notifyEventUpdate } from '@/lib/notifications/triggers'
```

In `createEvent`, add before the `revalidatePath` call:

```typescript
  // Notify group members (fire-and-forget)
  void notifyNewEvent(event.id).catch(console.error)
```

Note: You'll need to capture the created event's ID. Change the `prisma.event.create` call to:

```typescript
  const event = await prisma.event.create({
    data: { ... },
  })
```

And use `event.id` in the notification call.

In `updateEvent`, detect what changed and notify. Add before `revalidatePath`:

```typescript
  // Detect changes for notification
  const changes: string[] = []
  if (title.trim() !== event.title) changes.push('Title changed')
  if (new Date(dateTimeStr).getTime() !== event.dateTime.getTime()) changes.push('Time changed')
  if (((formData.get('placeName') as string)?.trim() || null) !== event.placeName) changes.push('Location changed')

  if (changes.length > 0) {
    void notifyEventUpdate(eventId, changes).catch(console.error)
  }
```

- [ ] **Step 2: Add RSVP milestone trigger**

In `src/lib/actions/rsvps.ts`, add import at the top:

```typescript
import { notifyRsvpMilestone } from '@/lib/notifications/triggers'
```

In `setRsvp`, add after the upsert and before `revalidatePath`:

```typescript
  // Check for RSVP milestone (fire-and-forget)
  if (status === 'DOWN') {
    void notifyRsvpMilestone(eventId).catch(console.error)
  }
```

- [ ] **Step 3: Verify no type errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/events.ts src/lib/actions/rsvps.ts
git commit -m "feat: hook notification triggers into event and RSVP actions"
```

---

### Task 6: Cron Job API Route

**Files:**
- Create: `src/app/api/cron/notifications/route.ts`, `vercel.json`

- [ ] **Step 1: Create the cron endpoint**

Write to `src/app/api/cron/notifications/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { sendEventReminders } from '@/lib/notifications/triggers'

export async function GET(request: Request) {
  // Verify cron secret in production
  const authHeader = request.headers.get('authorization')
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const remindersCount = await sendEventReminders()

    return NextResponse.json({
      ok: true,
      reminders: remindersCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Create vercel.json with cron config**

Write to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/notifications",
      "schedule": "0 * * * *"
    }
  ]
}
```

- [ ] **Step 3: Add CRON_SECRET to .env.example**

Append to `.env.example`:

```env

# Cron job security
# CRON_SECRET="" # Vercel Cron authorization secret
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/ vercel.json .env.example
git commit -m "feat: add cron job for event reminders"
```

---

### Task 7: Settings Server Actions

**Files:**
- Create: `src/lib/actions/settings.ts`

- [ ] **Step 1: Create preference update server actions**

Write to `src/lib/actions/settings.ts`:

```typescript
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function toggleEmailNotifications() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailNotifications: true },
  })
  if (!user) throw new Error('User not found')

  await prisma.user.update({
    where: { id: session.user.id },
    data: { emailNotifications: !user.emailNotifications },
  })

  revalidatePath('/settings')
}

export async function updateGroupNotificationPref(
  groupId: string,
  field: 'newEvents' | 'eventUpdates' | 'eventReminders' | 'rsvpMilestones',
  value: boolean
) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  await prisma.notificationPreference.upsert({
    where: {
      userId_groupId: { userId: session.user.id, groupId },
    },
    create: {
      userId: session.user.id,
      groupId,
      [field]: value,
    },
    update: {
      [field]: value,
    },
  })

  revalidatePath('/settings')
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/settings.ts
git commit -m "feat: add notification preference server actions"
```

---

### Task 8: User Settings Page

**Files:**
- Create: `src/app/(app)/settings/page.tsx`

- [ ] **Step 1: Create the settings page**

Write to `src/app/(app)/settings/page.tsx`:

```typescript
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { SettingsToggles } from './settings-toggles'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      image: true,
      emailNotifications: true,
    },
  })
  if (!user) redirect('/sign-in')

  const groups = await prisma.groupMember.findMany({
    where: { userId: session.user.id },
    include: {
      group: { select: { id: true, name: true } },
    },
  })

  const prefs = await prisma.notificationPreference.findMany({
    where: { userId: session.user.id },
  })

  const groupPrefs = groups.map((g) => {
    const pref = prefs.find((p) => p.groupId === g.group.id)
    return {
      groupId: g.group.id,
      groupName: g.group.name,
      newEvents: pref?.newEvents ?? true,
      eventUpdates: pref?.eventUpdates ?? true,
      eventReminders: pref?.eventReminders ?? true,
      rsvpMilestones: pref?.rsvpMilestones ?? true,
    }
  })

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold text-[var(--text-primary)]">Settings</h2>

      {/* Profile */}
      <div className="rounded-xl bg-[var(--bg-card)] p-4">
        <h3 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Profile</h3>
        <div className="flex items-center gap-3">
          {user.image ? (
            <img src={user.image} alt={user.name || ''} className="h-12 w-12 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-lg font-bold text-white">
              {(user.name || '?')[0].toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-medium text-[var(--text-primary)]">{user.name || 'Anonymous'}</p>
            <p className="text-sm text-[var(--text-secondary)]">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <SettingsToggles
        emailNotifications={user.emailNotifications}
        groupPrefs={groupPrefs}
      />
    </div>
  )
}
```

- [ ] **Step 2: Create the client component for toggles**

Write to `src/app/(app)/settings/settings-toggles.tsx`:

```typescript
'use client'

import { useTransition } from 'react'
import { toggleEmailNotifications, updateGroupNotificationPref } from '@/lib/actions/settings'

type GroupPref = {
  groupId: string
  groupName: string
  newEvents: boolean
  eventUpdates: boolean
  eventReminders: boolean
  rsvpMilestones: boolean
}

type Props = {
  emailNotifications: boolean
  groupPrefs: GroupPref[]
}

export function SettingsToggles({ emailNotifications, groupPrefs }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleGlobalToggle() {
    startTransition(async () => {
      await toggleEmailNotifications()
    })
  }

  function handleGroupToggle(
    groupId: string,
    field: 'newEvents' | 'eventUpdates' | 'eventReminders' | 'rsvpMilestones',
    currentValue: boolean
  ) {
    startTransition(async () => {
      await updateGroupNotificationPref(groupId, field, !currentValue)
    })
  }

  return (
    <div className="space-y-6">
      {/* Global Toggle */}
      <div className="rounded-xl bg-[var(--bg-card)] p-4">
        <h3 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">
          Email Notifications
        </h3>
        <Toggle
          label="Receive email notifications"
          checked={emailNotifications}
          onChange={handleGlobalToggle}
          disabled={isPending}
        />
      </div>

      {/* Per-Group Prefs */}
      {emailNotifications && groupPrefs.map((gp) => (
        <div key={gp.groupId} className="rounded-xl bg-[var(--bg-card)] p-4">
          <h3 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">
            {gp.groupName}
          </h3>
          <div className="space-y-3">
            <Toggle
              label="New events"
              checked={gp.newEvents}
              onChange={() => handleGroupToggle(gp.groupId, 'newEvents', gp.newEvents)}
              disabled={isPending}
            />
            <Toggle
              label="Event updates"
              checked={gp.eventUpdates}
              onChange={() => handleGroupToggle(gp.groupId, 'eventUpdates', gp.eventUpdates)}
              disabled={isPending}
            />
            <Toggle
              label="Event reminders (24hr before)"
              checked={gp.eventReminders}
              onChange={() => handleGroupToggle(gp.groupId, 'eventReminders', gp.eventReminders)}
              disabled={isPending}
            />
            <Toggle
              label="RSVP milestones"
              checked={gp.rsvpMilestones}
              onChange={() => handleGroupToggle(gp.groupId, 'rsvpMilestones', gp.rsvpMilestones)}
              disabled={isPending}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: () => void
  disabled: boolean
}) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-[var(--bg-surface)] ${disabled ? 'opacity-50' : ''}`}
    >
      <span className="text-sm text-[var(--text-primary)]">{label}</span>
      <div
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? 'bg-[var(--brand-accent)]' : 'bg-[var(--bg-surface)]'
        }`}
      >
        <div
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </div>
    </button>
  )
}
```

- [ ] **Step 3: Add settings link to the header**

In `src/components/layout/header.tsx`, add a link to settings. The header currently shows the org name and a theme toggle + avatar. Add a settings link that the avatar links to:

Wrap the avatar in a Link to `/settings`:

```typescript
import Link from 'next/link'
```

Replace the avatar section (the `{userImage ? ... : ...}` block) by wrapping it in:

```typescript
<Link href="/settings">
  {userImage ? (
    <img ... />
  ) : (
    <div ... />
  )}
</Link>
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/settings/ src/lib/actions/settings.ts src/components/layout/header.tsx
git commit -m "feat: add user notification settings page"
```

---

### Task 9: End-to-End Verification

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: All tests pass (format + whitelist + providers + templates + preferences).

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Start dev server and verify**

```bash
npm run dev
```

Verify:
1. **Create an event** — check console for `[Email - no API key]` log showing notification would be sent
2. **Edit an event** — change the time, check console for update notification log
3. **Settings page** — click avatar in header to go to /settings. See profile info, global email toggle, per-group notification toggles
4. **Toggle preferences** — turn off "New events" for the default group, create another event, confirm no notification log for the toggled-off preference
5. **If Resend is configured** — set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in .env, create an event, and verify a real email is received

- [ ] **Step 4: Test cron endpoint manually**

```bash
curl http://localhost:3000/api/cron/notifications
```

Expected: `{"ok":true,"reminders":0,"timestamp":"..."}`

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Phase 3 notifications"
```
