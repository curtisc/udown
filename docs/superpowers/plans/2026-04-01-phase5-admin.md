# Phase 5: Admin Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the admin dashboard with activity feed, whitelist management, access request approve/deny flow (with signed email links), org settings (branding + colors), member management, and groups overview.

**Architecture:** Admin section protected by org admin check (`isOrgAdmin`). Activity logging via a fire-and-forget helper hooked into existing server actions. Access request approval uses HMAC-signed URLs in emails. Org settings page supports color pickers and logo upload (Vercel Blob). Admin layout with horizontal tab navigation.

**Tech Stack:** Next.js 16, TypeScript, Tailwind v4, Prisma v7, Vercel Blob, Vitest

**Codebase notes:**
- `isOrgAdmin(userId)` from `@/lib/permissions` — checks ADMIN role on default group
- Existing server actions in `src/lib/actions/{events,groups,rsvps,settings}.ts`
- Notification infrastructure in `src/lib/notifications/` (send-email, templates, triggers)
- OrgSettings singleton loaded via `getOrgSettings()` from `@/lib/org-settings`
- ActivityLog model already in Prisma schema with 13 action types and metadata JSON

---

## File Map

**New files:**
```
src/lib/activity-log.ts                         # logActivity helper
src/lib/signed-url.ts                           # HMAC token generation/verification
src/__tests__/lib/signed-url.test.ts            # Signed URL tests
src/lib/actions/admin.ts                        # Whitelist CRUD, org settings, member mgmt
src/lib/notifications/access-request-email.ts   # Email template + trigger for access requests
src/app/(app)/admin/layout.tsx                  # Admin layout with tab nav
src/app/(app)/admin/page.tsx                    # Activity feed (landing)
src/app/(app)/admin/whitelist/page.tsx           # Whitelist management
src/app/(app)/admin/access-requests/page.tsx     # Access request management
src/app/(app)/admin/settings/page.tsx            # Org settings (branding, email)
src/app/(app)/admin/members/page.tsx             # Member management
src/app/(app)/admin/groups/page.tsx              # Groups overview
src/app/api/access-request/approve/[token]/route.ts  # Signed URL approve endpoint
src/app/api/access-request/deny/[token]/route.ts     # Signed URL deny endpoint
```

**Modified files:**
```
src/components/layout/header.tsx        # Add admin link (org admin only)
src/app/(app)/layout.tsx                # Pass isAdmin to header
src/lib/auth.ts                         # Add access request email notification
src/lib/actions/events.ts               # Add activity logging
src/lib/actions/groups.ts               # Add activity logging
src/lib/actions/rsvps.ts                # Add activity logging
.env.example                            # Add BLOB_READ_WRITE_TOKEN
```

---

### Task 1: Activity Log Utility

**Files:**
- Create: `src/lib/activity-log.ts`

- [ ] **Step 1: Create the activity log helper**

Write to `src/lib/activity-log.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import type { ActivityAction, ActivityTarget } from '@prisma/client'

export function logActivity(params: {
  actorId: string
  action: ActivityAction
  targetType: ActivityTarget
  targetId: string
  metadata: Record<string, unknown>
}): void {
  // Fire-and-forget — don't block the calling action
  void prisma.activityLog
    .create({
      data: {
        actorId: params.actorId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        metadata: params.metadata,
      },
    })
    .catch(console.error)
}
```

- [ ] **Step 2: Hook into existing server actions**

Add `import { logActivity } from '@/lib/activity-log'` to each file and add logging calls:

**In `src/lib/actions/events.ts`:**

After `const event = await prisma.event.create(...)` in `createEvent`:
```typescript
  logActivity({
    actorId: session.user.id,
    action: 'EVENT_CREATED',
    targetType: 'EVENT',
    targetId: event.id,
    metadata: { eventTitle: event.title, groupId: targetGroupId },
  })
```

After `await prisma.event.update(...)` in `updateEvent`:
```typescript
  logActivity({
    actorId: session.user.id,
    action: 'EVENT_UPDATED',
    targetType: 'EVENT',
    targetId: eventId,
    metadata: { eventTitle: title.trim(), changes },
  })
```

After `await prisma.event.delete(...)` in `deleteEvent`:
```typescript
  logActivity({
    actorId: session.user.id,
    action: 'EVENT_DELETED',
    targetType: 'EVENT',
    targetId: eventId,
    metadata: { eventTitle: event.title },
  })
```

**In `src/lib/actions/groups.ts`:**

After `const group = await prisma.group.create(...)` in `createGroup`:
```typescript
  logActivity({
    actorId: session.user.id,
    action: 'GROUP_CREATED',
    targetType: 'GROUP',
    targetId: group.id,
    metadata: { groupName: group.name },
  })
```

After `await prisma.groupMember.create(...)` in `joinGroup`:
```typescript
  logActivity({
    actorId: session.user.id,
    action: 'GROUP_JOINED',
    targetType: 'GROUP',
    targetId: groupId,
    metadata: {},
  })
```

After the delete in `leaveGroup`:
```typescript
  logActivity({
    actorId: session.user.id,
    action: 'GROUP_LEFT',
    targetType: 'GROUP',
    targetId: groupId,
    metadata: {},
  })
```

After the delete in `removeMember`:
```typescript
  logActivity({
    actorId: session.user.id,
    action: 'MEMBER_REMOVED',
    targetType: 'GROUP',
    targetId: groupId,
    metadata: { removedUserId: targetUserId },
  })
```

**In `src/lib/actions/rsvps.ts`:**

After the upsert in `setRsvp`:
```typescript
  logActivity({
    actorId: session.user.id,
    action: status === currentRsvp ? 'RSVP_UPDATED' : 'RSVP_CREATED',
    targetType: 'EVENT',
    targetId: eventId,
    metadata: { status, guestCount },
  })
```

Note: You'll need to fetch the existing RSVP before the upsert to determine if it's a create or update. Add before the upsert:
```typescript
  const currentRsvp = await prisma.rSVP.findUnique({
    where: { userId_eventId: { userId: session.user.id, eventId } },
  })
```

Then use `currentRsvp ? 'RSVP_UPDATED' : 'RSVP_CREATED'` for the action.

- [ ] **Step 3: Verify no type errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/activity-log.ts src/lib/actions/
git commit -m "feat: add activity logging to all server actions"
```

---

### Task 2: Signed URL Utility (TDD)

**Files:**
- Create: `src/lib/signed-url.ts`, `src/__tests__/lib/signed-url.test.ts`

- [ ] **Step 1: Write the failing tests**

Write to `src/__tests__/lib/signed-url.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateSignedToken, verifySignedToken } from '@/lib/signed-url'

describe('signed URL tokens', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_SECRET', 'test-secret-key-for-hmac')
  })

  it('generates a non-empty token', () => {
    const token = generateSignedToken('request-123', 'approve')
    expect(token).toBeTruthy()
    expect(typeof token).toBe('string')
  })

  it('verifies a valid token', () => {
    const token = generateSignedToken('request-123', 'approve')
    expect(verifySignedToken(token, 'request-123', 'approve')).toBe(true)
  })

  it('rejects a token with wrong request ID', () => {
    const token = generateSignedToken('request-123', 'approve')
    expect(verifySignedToken(token, 'request-456', 'approve')).toBe(false)
  })

  it('rejects a token with wrong action', () => {
    const token = generateSignedToken('request-123', 'approve')
    expect(verifySignedToken(token, 'request-123', 'deny')).toBe(false)
  })

  it('rejects a tampered token', () => {
    expect(verifySignedToken('tampered-token', 'request-123', 'approve')).toBe(false)
  })

  it('generates different tokens for different inputs', () => {
    const token1 = generateSignedToken('request-123', 'approve')
    const token2 = generateSignedToken('request-123', 'deny')
    expect(token1).not.toBe(token2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/lib/signed-url.test.ts
```

- [ ] **Step 3: Write the implementation**

Write to `src/lib/signed-url.ts`:

```typescript
import { createHmac } from 'crypto'

function getSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not set')
  return secret
}

export function generateSignedToken(requestId: string, action: string): string {
  const payload = `${requestId}:${action}`
  const hmac = createHmac('sha256', getSecret())
  hmac.update(payload)
  const signature = hmac.digest('hex')
  return Buffer.from(`${payload}:${signature}`).toString('base64url')
}

export function verifySignedToken(
  token: string,
  requestId: string,
  action: string
): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString()
    const parts = decoded.split(':')
    if (parts.length !== 3) return false

    const [tokenRequestId, tokenAction, tokenSignature] = parts
    if (tokenRequestId !== requestId || tokenAction !== action) return false

    const expectedPayload = `${requestId}:${action}`
    const hmac = createHmac('sha256', getSecret())
    hmac.update(expectedPayload)
    const expectedSignature = hmac.digest('hex')

    return tokenSignature === expectedSignature
  } catch {
    return false
  }
}

export function generateAccessRequestUrl(
  requestId: string,
  action: 'approve' | 'deny'
): string {
  const base = process.env.AUTH_URL || 'http://localhost:3000'
  const token = generateSignedToken(requestId, action)
  return `${base}/api/access-request/${action}/${token}?requestId=${requestId}`
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/__tests__/lib/signed-url.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/signed-url.ts src/__tests__/lib/signed-url.test.ts
git commit -m "feat: add HMAC signed URL utility for access requests"
```

---

### Task 3: Access Request Email + Hook into Auth

**Files:**
- Create: `src/lib/notifications/access-request-email.ts`
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Create access request email template and trigger**

Write to `src/lib/notifications/access-request-email.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import { getOrgSettings } from '@/lib/org-settings'
import { sendEmail } from './send-email'
import { baseEmailHtml } from './templates'
import { generateAccessRequestUrl } from '@/lib/signed-url'

export async function notifyAdminsOfAccessRequest(requestId: string): Promise<void> {
  const request = await prisma.accessRequest.findUnique({
    where: { id: requestId },
  })
  if (!request) return

  const org = await getOrgSettings()

  const defaultGroup = await prisma.group.findFirst({
    where: { isDefault: true },
  })
  if (!defaultGroup) return

  const admins = await prisma.groupMember.findMany({
    where: { groupId: defaultGroup.id, role: 'ADMIN' },
    include: { user: { select: { email: true, emailNotifications: true } } },
  })

  const notifiableAdmins = admins.filter((a) => a.user.emailNotifications)
  if (notifiableAdmins.length === 0) return

  const approveUrl = generateAccessRequestUrl(requestId, 'approve')
  const denyUrl = generateAccessRequestUrl(requestId, 'deny')

  const textPrimary = '#f1f5f9'
  const textSecondary = '#94a3b8'
  const accentColor = '#16a0ac'

  const content = `
    <h2 style="margin:0 0 12px;font-size:20px;color:${textPrimary};">New Access Request</h2>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="padding:4px 0;font-size:14px;color:${textPrimary};">
          <strong>${request.name}</strong>
        </td>
      </tr>
      <tr>
        <td style="padding:4px 0;font-size:14px;color:${textSecondary};">
          ${request.email}
        </td>
      </tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding-right:8px;">
          <a href="${approveUrl}" style="display:inline-block;background-color:${accentColor};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
            Approve
          </a>
        </td>
        <td>
          <a href="${denyUrl}" style="display:inline-block;background-color:#374151;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
            Deny
          </a>
        </td>
      </tr>
    </table>
  `

  const subject = `Access request from ${request.name}`
  const html = baseEmailHtml({ ...org, preheader: subject, content })

  await sendEmail({
    to: notifiableAdmins.map((a) => a.user.email),
    subject,
    html,
  })
}

export async function notifyAccessApproved(email: string): Promise<void> {
  const org = await getOrgSettings()
  const base = process.env.AUTH_URL || 'http://localhost:3000'

  const textPrimary = '#f1f5f9'
  const accentColor = '#16a0ac'

  const content = `
    <h2 style="margin:0 0 12px;font-size:20px;color:${textPrimary};">You're in!</h2>
    <p style="margin:0 0 20px;font-size:14px;color:${textPrimary};">
      Your access request to ${org.orgName} has been approved. Sign in to get started.
    </p>
    <a href="${base}/sign-in" style="display:inline-block;background-color:${accentColor};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
      Sign In
    </a>
  `

  const subject = `Welcome to ${org.orgName}!`
  const html = baseEmailHtml({ ...org, preheader: subject, content })

  await sendEmail({ to: email, subject, html })
}
```

- [ ] **Step 2: Hook notification into auth.ts signIn callback**

In `src/lib/auth.ts`, add import:
```typescript
import { notifyAdminsOfAccessRequest } from '@/lib/notifications/access-request-email'
```

In the signIn callback, after creating the access request (the `if (!existing)` block), add:
```typescript
          void notifyAdminsOfAccessRequest(newRequest.id).catch(console.error)
```

You'll need to capture the create result:
```typescript
        if (!existing) {
          const newRequest = await prisma.accessRequest.create({
            data: { ... },
          })
          void notifyAdminsOfAccessRequest(newRequest.id).catch(console.error)
        }
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/notifications/access-request-email.ts src/lib/auth.ts
git commit -m "feat: add access request email notification to admins"
```

---

### Task 4: Access Request Approve/Deny API Routes

**Files:**
- Create: `src/app/api/access-request/approve/[token]/route.ts`, `src/app/api/access-request/deny/[token]/route.ts`

- [ ] **Step 1: Create approve endpoint**

Write to `src/app/api/access-request/approve/[token]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySignedToken } from '@/lib/signed-url'
import { notifyAccessApproved } from '@/lib/notifications/access-request-email'
import { logActivity } from '@/lib/activity-log'

type Props = {
  params: Promise<{ token: string }>
}

export async function GET(request: Request, { params }: Props) {
  const { token } = await params
  const url = new URL(request.url)
  const requestId = url.searchParams.get('requestId')

  if (!requestId || !verifySignedToken(token, requestId, 'approve')) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 })
  }

  const accessRequest = await prisma.accessRequest.findUnique({
    where: { id: requestId },
  })
  if (!accessRequest) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }
  if (accessRequest.status !== 'PENDING') {
    return NextResponse.json({ error: `Request already ${accessRequest.status.toLowerCase()}` }, { status: 400 })
  }

  // Add email to whitelist
  await prisma.emailWhitelist.upsert({
    where: { email_type: { email: accessRequest.email, type: 'EMAIL' } },
    create: { email: accessRequest.email, type: 'EMAIL' },
    update: {},
  })

  // Update access request status
  await prisma.accessRequest.update({
    where: { id: requestId },
    data: { status: 'APPROVED', respondedAt: new Date() },
  })

  // Send welcome email
  void notifyAccessApproved(accessRequest.email).catch(console.error)

  // Redirect to a success page
  const base = process.env.AUTH_URL || 'http://localhost:3000'
  return NextResponse.redirect(`${base}/admin/access-requests?approved=${accessRequest.email}`)
}
```

- [ ] **Step 2: Create deny endpoint**

Write to `src/app/api/access-request/deny/[token]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySignedToken } from '@/lib/signed-url'

type Props = {
  params: Promise<{ token: string }>
}

export async function GET(request: Request, { params }: Props) {
  const { token } = await params
  const url = new URL(request.url)
  const requestId = url.searchParams.get('requestId')

  if (!requestId || !verifySignedToken(token, requestId, 'deny')) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 })
  }

  const accessRequest = await prisma.accessRequest.findUnique({
    where: { id: requestId },
  })
  if (!accessRequest) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }
  if (accessRequest.status !== 'PENDING') {
    return NextResponse.json({ error: `Request already ${accessRequest.status.toLowerCase()}` }, { status: 400 })
  }

  await prisma.accessRequest.update({
    where: { id: requestId },
    data: { status: 'DENIED', respondedAt: new Date() },
  })

  const base = process.env.AUTH_URL || 'http://localhost:3000'
  return NextResponse.redirect(`${base}/admin/access-requests?denied=${accessRequest.email}`)
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/access-request/
git commit -m "feat: add signed URL approve/deny API routes for access requests"
```

---

### Task 5: Admin Server Actions

**Files:**
- Create: `src/lib/actions/admin.ts`

- [ ] **Step 1: Create admin server actions**

Write to `src/lib/actions/admin.ts`:

```typescript
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { isOrgAdmin } from '@/lib/permissions'
import { logActivity } from '@/lib/activity-log'
import { put } from '@vercel/blob'

async function requireOrgAdmin() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  const admin = await isOrgAdmin(session.user.id)
  if (!admin) throw new Error('Not an org admin')
  return session
}

// ---- Whitelist ----

export async function addWhitelistEntry(formData: FormData) {
  const session = await requireOrgAdmin()
  const emails = (formData.get('emails') as string)?.trim()
  if (!emails) throw new Error('No emails provided')

  const entries = emails.split(/[,\n]/).map((e) => e.trim()).filter(Boolean)

  for (const entry of entries) {
    const isDomain = !entry.includes('@')
    const email = isDomain ? entry.replace(/^@/, '') : entry.toLowerCase()
    const type = isDomain ? 'DOMAIN' : 'EMAIL'

    await prisma.emailWhitelist.upsert({
      where: { email_type: { email, type } },
      create: { email, type, addedById: session.user.id },
      update: {},
    })
  }

  logActivity({
    actorId: session.user.id,
    action: 'SETTINGS_UPDATED',
    targetType: 'SETTINGS',
    targetId: 'whitelist',
    metadata: { added: entries },
  })

  revalidatePath('/admin/whitelist')
}

export async function removeWhitelistEntry(entryId: string) {
  const session = await requireOrgAdmin()

  const entry = await prisma.emailWhitelist.findUnique({ where: { id: entryId } })
  if (!entry) throw new Error('Entry not found')

  await prisma.emailWhitelist.delete({ where: { id: entryId } })

  logActivity({
    actorId: session.user.id,
    action: 'SETTINGS_UPDATED',
    targetType: 'SETTINGS',
    targetId: 'whitelist',
    metadata: { removed: entry.email },
  })

  revalidatePath('/admin/whitelist')
}

// ---- Org Settings ----

export async function updateOrgSettings(formData: FormData) {
  const session = await requireOrgAdmin()

  const orgName = (formData.get('orgName') as string)?.trim()
  if (!orgName) throw new Error('Org name is required')

  const data: Record<string, unknown> = {
    orgName,
    primaryColor: (formData.get('primaryColor') as string) || '#003262',
    accentColor: (formData.get('accentColor') as string) || '#16a0ac',
    fromEmail: (formData.get('fromEmail') as string)?.trim() || null,
    fromName: (formData.get('fromName') as string)?.trim() || null,
  }

  // Handle logo upload
  const logo = formData.get('logo') as File | null
  if (logo && logo.size > 0) {
    try {
      const blob = await put(`org-logo-${Date.now()}.${logo.name.split('.').pop()}`, logo, {
        access: 'public',
      })
      data.orgLogo = blob.url
    } catch (error) {
      console.error('Logo upload failed:', error)
    }
  }

  const existing = await prisma.orgSettings.findFirst()
  if (existing) {
    await prisma.orgSettings.update({
      where: { id: existing.id },
      data,
    })
  } else {
    await prisma.orgSettings.create({ data: data as Parameters<typeof prisma.orgSettings.create>[0]['data'] })
  }

  logActivity({
    actorId: session.user.id,
    action: 'SETTINGS_UPDATED',
    targetType: 'SETTINGS',
    targetId: 'org',
    metadata: { orgName },
  })

  revalidatePath('/admin/settings')
  revalidatePath('/', 'layout')
}

// ---- Members ----

export async function promoteToOrgAdmin(userId: string) {
  const session = await requireOrgAdmin()

  const defaultGroup = await prisma.group.findFirst({ where: { isDefault: true } })
  if (!defaultGroup) throw new Error('No default group')

  await prisma.groupMember.update({
    where: { userId_groupId: { userId, groupId: defaultGroup.id } },
    data: { role: 'ADMIN' },
  })

  logActivity({
    actorId: session.user.id,
    action: 'SETTINGS_UPDATED',
    targetType: 'USER',
    targetId: userId,
    metadata: { action: 'promoted to org admin' },
  })

  revalidatePath('/admin/members')
}

export async function demoteFromOrgAdmin(userId: string) {
  const session = await requireOrgAdmin()

  const defaultGroup = await prisma.group.findFirst({ where: { isDefault: true } })
  if (!defaultGroup) throw new Error('No default group')
  if (defaultGroup.ownerId === userId) throw new Error('Cannot demote the org owner')

  await prisma.groupMember.update({
    where: { userId_groupId: { userId, groupId: defaultGroup.id } },
    data: { role: 'MEMBER' },
  })

  logActivity({
    actorId: session.user.id,
    action: 'SETTINGS_UPDATED',
    targetType: 'USER',
    targetId: userId,
    metadata: { action: 'demoted from org admin' },
  })

  revalidatePath('/admin/members')
}
```

- [ ] **Step 2: Add BLOB_READ_WRITE_TOKEN to .env.example**

Append to `.env.example`:
```env

# File storage (Vercel Blob for org logo)
# BLOB_READ_WRITE_TOKEN="" # Vercel Blob token
```

- [ ] **Step 3: Verify no type errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/admin.ts .env.example
git commit -m "feat: add admin server actions for whitelist, settings, and members"
```

---

### Task 6: Admin Layout + Header Link

**Files:**
- Create: `src/app/(app)/admin/layout.tsx`
- Modify: `src/components/layout/header.tsx`, `src/app/(app)/layout.tsx`

- [ ] **Step 1: Create admin layout with tab navigation**

Write to `src/app/(app)/admin/layout.tsx`:

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isOrgAdmin } from '@/lib/permissions'
import Link from 'next/link'

const tabs = [
  { href: '/admin', label: 'Activity' },
  { href: '/admin/whitelist', label: 'Whitelist' },
  { href: '/admin/access-requests', label: 'Requests' },
  { href: '/admin/settings', label: 'Settings' },
  { href: '/admin/members', label: 'Members' },
  { href: '/admin/groups', label: 'Groups' },
]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const admin = await isOrgAdmin(session.user.id)
  if (!admin) redirect('/feed')

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Admin</h2>
        <nav className="mt-3 flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Add admin link to header**

Modify `src/components/layout/header.tsx` to accept an `isAdmin` prop and conditionally show an Admin link:

Add `isAdmin?: boolean` to `HeaderProps`. Add after the Groups nav link:
```typescript
{isAdmin && (
  <Link
    href="/admin"
    className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
  >
    Admin
  </Link>
)}
```

- [ ] **Step 3: Pass isAdmin from app layout**

Modify `src/app/(app)/layout.tsx` to check admin status and pass it to Header:

Add import:
```typescript
import { isOrgAdmin } from '@/lib/permissions'
```

After the session check, add:
```typescript
  const admin = await isOrgAdmin(session.user.id)
```

Pass to Header:
```typescript
  <Header
    userName={session.user.name}
    userImage={session.user.image}
    orgName={org.orgName}
    isAdmin={admin}
  />
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/admin/layout.tsx src/components/layout/header.tsx src/app/\(app\)/layout.tsx
git commit -m "feat: add admin layout with tab navigation and header link"
```

---

### Task 7: Admin Pages — Whitelist, Access Requests, Org Settings, Members, Groups, Activity Feed

**Files:** Create all 6 admin page files.

This is a large task but each page follows the same pattern: fetch data, render a list/form. The implementer should create all 6 files and commit each separately.

- [ ] **Step 1: Create whitelist management page**

Write to `src/app/(app)/admin/whitelist/page.tsx`:

```typescript
import { prisma } from '@/lib/prisma'
import { addWhitelistEntry, removeWhitelistEntry } from '@/lib/actions/admin'
import { RemoveButton } from './remove-button'

export default async function WhitelistPage() {
  const entries = await prisma.emailWhitelist.findMany({
    include: { addedBy: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <form action={addWhitelistEntry} className="rounded-xl bg-[var(--bg-card)] p-4">
        <label htmlFor="emails" className="block text-sm font-medium text-[var(--text-primary)]">
          Add emails or domains
        </label>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Comma-separated. Use bare domains (e.g. berkeley.edu) for wildcards.
        </p>
        <textarea
          id="emails"
          name="emails"
          rows={3}
          required
          placeholder="alice@example.com, bob@example.com, stanford.edu"
          className="mt-2 w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-secondary)] text-sm focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
        />
        <button
          type="submit"
          className="mt-2 rounded-lg bg-[var(--brand-accent)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Add to Whitelist
        </button>
      </form>

      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center justify-between rounded-lg bg-[var(--bg-card)] px-4 py-3"
          >
            <div>
              <span className="text-sm text-[var(--text-primary)]">
                {entry.type === 'DOMAIN' ? `@${entry.email}` : entry.email}
              </span>
              <span className="ml-2 text-xs text-[var(--text-secondary)]">
                {entry.type === 'DOMAIN' ? '(domain)' : '(email)'}
                {entry.addedBy && ` — added by ${entry.addedBy.name}`}
              </span>
            </div>
            <RemoveButton entryId={entry.id} />
          </div>
        ))}
        {entries.length === 0 && (
          <p className="py-4 text-center text-sm text-[var(--text-secondary)]">
            No whitelist entries yet.
          </p>
        )}
      </div>
    </div>
  )
}
```

Write to `src/app/(app)/admin/whitelist/remove-button.tsx`:

```typescript
'use client'

import { useTransition } from 'react'
import { removeWhitelistEntry } from '@/lib/actions/admin'

export function RemoveButton({ entryId }: { entryId: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => startTransition(() => removeWhitelistEntry(entryId))}
      disabled={isPending}
      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
    >
      Remove
    </button>
  )
}
```

- [ ] **Step 2: Create access requests page**

Write to `src/app/(app)/admin/access-requests/page.tsx`:

```typescript
import { prisma } from '@/lib/prisma'

export default async function AccessRequestsPage() {
  const pending = await prisma.accessRequest.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  })

  const history = await prisma.accessRequest.findMany({
    where: { status: { not: 'PENDING' } },
    include: { respondedBy: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">
          Pending ({pending.length})
        </h3>
        {pending.length > 0 ? (
          <div className="space-y-2">
            {pending.map((req) => (
              <div key={req.id} className="flex items-center justify-between rounded-lg bg-[var(--bg-card)] px-4 py-3">
                <div className="flex items-center gap-3">
                  {req.image ? (
                    <img src={req.image} alt={req.name} className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-surface)] text-sm font-bold text-[var(--text-secondary)]">
                      {req.name[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{req.name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{req.email}</p>
                  </div>
                </div>
                <span className="text-xs text-[var(--text-secondary)]">
                  {req.createdAt.toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-[var(--text-secondary)]">No pending requests.</p>
        )}
        <p className="mt-2 text-xs text-[var(--text-secondary)]">
          Approve or deny requests via the links in the email notification.
        </p>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">History</h3>
        {history.length > 0 ? (
          <div className="space-y-2">
            {history.map((req) => (
              <div key={req.id} className="flex items-center justify-between rounded-lg bg-[var(--bg-card)] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm text-[var(--text-primary)]">{req.name} — {req.email}</p>
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  req.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {req.status.toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-[var(--text-secondary)]">No history yet.</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create org settings page**

Write to `src/app/(app)/admin/settings/page.tsx`:

```typescript
import { prisma } from '@/lib/prisma'
import { getOrgSettings } from '@/lib/org-settings'
import { updateOrgSettings } from '@/lib/actions/admin'

export default async function OrgSettingsPage() {
  const org = await getOrgSettings()

  return (
    <form action={updateOrgSettings} className="space-y-6">
      <div className="rounded-xl bg-[var(--bg-card)] p-4 space-y-4">
        <h3 className="text-sm font-medium text-[var(--text-secondary)]">Branding</h3>

        <div>
          <label htmlFor="orgName" className="block text-sm font-medium text-[var(--text-primary)]">
            Organization name *
          </label>
          <input
            id="orgName"
            name="orgName"
            type="text"
            required
            defaultValue={org.orgName}
            className="mt-1 w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
          />
        </div>

        <div>
          <label htmlFor="logo" className="block text-sm font-medium text-[var(--text-primary)]">
            Logo
          </label>
          {org.orgLogo && (
            <img src={org.orgLogo} alt="Current logo" className="my-2 h-12 w-auto" />
          )}
          <input
            id="logo"
            name="logo"
            type="file"
            accept="image/*"
            className="mt-1 text-sm text-[var(--text-secondary)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="primaryColor" className="block text-sm font-medium text-[var(--text-primary)]">
              Primary color
            </label>
            <input
              id="primaryColor"
              name="primaryColor"
              type="color"
              defaultValue={org.primaryColor}
              className="mt-1 h-10 w-full cursor-pointer rounded-lg border border-[var(--bg-surface)]"
            />
          </div>
          <div>
            <label htmlFor="accentColor" className="block text-sm font-medium text-[var(--text-primary)]">
              Accent color
            </label>
            <input
              id="accentColor"
              name="accentColor"
              type="color"
              defaultValue={org.accentColor}
              className="mt-1 h-10 w-full cursor-pointer rounded-lg border border-[var(--bg-surface)]"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-[var(--bg-card)] p-4 space-y-4">
        <h3 className="text-sm font-medium text-[var(--text-secondary)]">Email</h3>

        <div>
          <label htmlFor="fromEmail" className="block text-sm font-medium text-[var(--text-primary)]">
            From email address
          </label>
          <input
            id="fromEmail"
            name="fromEmail"
            type="email"
            defaultValue={org.fromEmail || ''}
            placeholder="events@yourdomain.com"
            className="mt-1 w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
          />
        </div>

        <div>
          <label htmlFor="fromName" className="block text-sm font-medium text-[var(--text-primary)]">
            From display name
          </label>
          <input
            id="fromName"
            name="fromName"
            type="text"
            defaultValue={org.fromName || ''}
            placeholder={org.orgName}
            className="mt-1 w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
          />
        </div>
      </div>

      <button
        type="submit"
        className="rounded-lg bg-[var(--brand-accent)] px-6 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Save Settings
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Create members page**

Write to `src/app/(app)/admin/members/page.tsx`:

```typescript
import { prisma } from '@/lib/prisma'
import { MemberActions } from './member-actions'

export default async function MembersPage() {
  const defaultGroup = await prisma.group.findFirst({ where: { isDefault: true } })
  if (!defaultGroup) return null

  const members = await prisma.groupMember.findMany({
    where: { groupId: defaultGroup.id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          createdAt: true,
          groupMemberships: {
            select: { group: { select: { name: true } } },
          },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  })

  return (
    <div className="space-y-2">
      {members.map((m) => (
        <div key={m.userId} className="flex items-center justify-between rounded-lg bg-[var(--bg-card)] px-4 py-3">
          <div className="flex items-center gap-3">
            {m.user.image ? (
              <img src={m.user.image} alt={m.user.name || ''} className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-surface)] text-sm font-bold text-[var(--text-secondary)]">
                {(m.user.name || '?')[0].toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">{m.user.name || 'Anonymous'}</p>
              <p className="text-xs text-[var(--text-secondary)]">
                {m.user.email} — {m.user.groupMemberships.length} group{m.user.groupMemberships.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <MemberActions
            userId={m.userId}
            role={m.role}
            isOwner={defaultGroup.ownerId === m.userId}
          />
        </div>
      ))}
    </div>
  )
}
```

Write to `src/app/(app)/admin/members/member-actions.tsx`:

```typescript
'use client'

import { useTransition } from 'react'
import { promoteToOrgAdmin, demoteFromOrgAdmin } from '@/lib/actions/admin'

type Props = {
  userId: string
  role: string
  isOwner: boolean
}

export function MemberActions({ userId, role, isOwner }: Props) {
  const [isPending, startTransition] = useTransition()

  if (isOwner) {
    return <span className="rounded-full bg-[var(--brand-accent)]/20 px-2 py-0.5 text-xs font-medium text-[var(--brand-accent)]">Owner</span>
  }

  return (
    <div className="flex items-center gap-2">
      {role === 'ADMIN' ? (
        <>
          <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-400">Admin</span>
          <button
            onClick={() => startTransition(() => demoteFromOrgAdmin(userId))}
            disabled={isPending}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            Demote
          </button>
        </>
      ) : (
        <button
          onClick={() => startTransition(() => promoteToOrgAdmin(userId))}
          disabled={isPending}
          className="text-xs text-[var(--brand-accent)] hover:underline disabled:opacity-50"
        >
          Make Admin
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create groups overview page**

Write to `src/app/(app)/admin/groups/page.tsx`:

```typescript
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export default async function AdminGroupsPage() {
  const groups = await prisma.group.findMany({
    include: {
      _count: { select: { members: true, events: true } },
      owner: { select: { name: true } },
    },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  })

  const now = new Date()

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const daysSinceEvent = group.lastEventAt
          ? Math.floor((now.getTime() - group.lastEventAt.getTime()) / (1000 * 60 * 60 * 24))
          : null
        const isInactive = daysSinceEvent !== null && daysSinceEvent > group.inactivityThresholdDays

        return (
          <Link
            key={group.id}
            href={`/groups/${group.id}`}
            className="flex items-center justify-between rounded-lg bg-[var(--bg-card)] px-4 py-3 transition-colors hover:bg-[var(--bg-surface)]"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">{group.name}</span>
                {group.isDefault && (
                  <span className="rounded-full bg-[var(--brand-accent)]/20 px-2 py-0.5 text-xs text-[var(--brand-accent)]">Main</span>
                )}
                {isInactive && (
                  <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400">Inactive</span>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                {group._count.members} members · {group._count.events} events · Owner: {group.owner.name}
              </p>
            </div>
            <span className="text-xs text-[var(--text-secondary)]">
              {group.lastEventAt
                ? `Last event ${daysSinceEvent}d ago`
                : 'No events'}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 6: Create activity feed page (admin landing)**

Write to `src/app/(app)/admin/page.tsx`:

```typescript
import { prisma } from '@/lib/prisma'

const actionLabels: Record<string, string> = {
  USER_JOINED: 'joined',
  EVENT_CREATED: 'created event',
  EVENT_UPDATED: 'updated event',
  EVENT_DELETED: 'deleted event',
  RSVP_CREATED: "RSVP'd to",
  RSVP_UPDATED: 'updated RSVP for',
  GROUP_CREATED: 'created group',
  GROUP_JOINED: 'joined group',
  GROUP_LEFT: 'left group',
  MEMBER_REMOVED: 'removed a member from',
  ACCESS_REQUESTED: 'requested access',
  ACCESS_APPROVED: 'approved access for',
  ACCESS_DENIED: 'denied access for',
  SETTINGS_UPDATED: 'updated settings',
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default async function AdminActivityPage() {
  const logs = await prisma.activityLog.findMany({
    include: { actor: { select: { name: true, image: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return (
    <div className="space-y-2">
      {logs.length > 0 ? (
        logs.map((log) => {
          const meta = log.metadata as Record<string, string>
          const label = actionLabels[log.action] || log.action

          return (
            <div key={log.id} className="flex items-start gap-3 rounded-lg bg-[var(--bg-card)] px-4 py-3">
              {log.actor.image ? (
                <img src={log.actor.image} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-surface)] text-xs font-bold text-[var(--text-secondary)]">
                  {(log.actor.name || '?')[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm text-[var(--text-primary)]">
                  <strong>{log.actor.name || 'Someone'}</strong>{' '}
                  {label}
                  {meta.eventTitle && ` "${meta.eventTitle}"`}
                  {meta.groupName && ` in ${meta.groupName}`}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">{timeAgo(log.createdAt)}</p>
              </div>
            </div>
          )
        })
      ) : (
        <p className="py-8 text-center text-sm text-[var(--text-secondary)]">No activity yet.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Commit all pages**

```bash
git add src/app/\(app\)/admin/
git commit -m "feat: add all admin dashboard pages"
```

---

### Task 8: End-to-End Verification

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

1. **Admin link** — visible in header only when logged in as org admin
2. **Activity feed** — shows recent actions (create events, RSVPs, etc.)
3. **Whitelist** — add emails/domains, see them listed, remove entries
4. **Access requests** — see pending Gmail request from Phase 1 testing
5. **Org settings** — change org name, pick colors, upload logo (if Blob is configured), save
6. **Members** — see all users, promote/demote org admin
7. **Groups overview** — see all groups with stats and inactive indicators

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Phase 5 admin dashboard"
```
