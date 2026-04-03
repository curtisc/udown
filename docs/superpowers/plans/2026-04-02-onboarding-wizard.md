# Onboarding Wizard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first-run setup wizard that guides the first user (org admin) through configuring org settings, adding members to the whitelist (with invite emails), and optionally creating groups — before anyone can use the app.

**Architecture:** Multi-step wizard at `/onboarding` with server actions for each step. Route guard in the app layout redirects to onboarding when `OrgSettings.onboardingComplete` is false. Bootstrap auth allows the first user to sign in without a whitelist. Invite emails sent via existing Resend infrastructure.

**Tech Stack:** Next.js 16, TypeScript, Tailwind v4, Prisma v7, Resend

**Codebase notes:**
- Pending uncommitted change in `src/lib/auth.ts` adds the bootstrap check (`userCount === 0 → allow sign-in`)
- `getOrgSettings()` at `@/lib/org-settings` returns org branding with env var fallbacks
- Email sending via `sendEmail()` at `@/lib/notifications/send-email`
- Base email template via `baseEmailHtml()` at `@/lib/notifications/templates`
- Admin whitelist actions at `@/lib/actions/admin` (`addWhitelistEntry`, etc.)
- Group creation at `@/lib/actions/groups` (`createGroup`)

---

## File Map

**New files:**
```
src/app/(app)/onboarding/layout.tsx          # Clean wizard layout (no header/nav)
src/app/(app)/onboarding/page.tsx            # Wizard with step state
src/lib/actions/onboarding.ts                # Server actions for onboarding steps
src/lib/notifications/invite-email.ts        # Invite email template + send function
```

**Modified files:**
```
prisma/schema.prisma                          # Add onboardingComplete to OrgSettings
src/app/(app)/layout.tsx                      # Route guard: redirect to /onboarding if not complete
src/lib/auth.ts                               # Bootstrap: first user skips whitelist (already pending)
src/lib/org-settings.ts                       # Remove ORG_NAME fallback
src/lib/actions/admin.ts                      # Send invite email when adding whitelist entries
.env.example                                  # Remove ORG_NAME, ORG_DOMAIN
prisma.config.ts                              # Remove seed config
```

**Deleted files:**
```
prisma/seed.ts                                # No longer needed
```

---

### Task 1: Schema Change + Remove Seed

**Files:**
- Modify: `prisma/schema.prisma`
- Delete: `prisma/seed.ts`
- Modify: `prisma.config.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add onboardingComplete to OrgSettings**

In `prisma/schema.prisma`, add to the OrgSettings model after `defaultSmsNotifications`:

```prisma
  onboardingComplete          Boolean  @default(false)
```

- [ ] **Step 2: Remove seed script and config**

Delete `prisma/seed.ts`.

In `prisma.config.ts`, remove the `seed` line from the migrations config:

```typescript
  migrations: {
    path: "prisma/migrations",
  },
```

- [ ] **Step 3: Remove ORG_NAME and ORG_DOMAIN from .env.example**

Remove these lines:
```
ORG_NAME="My Community"
# ORG_DOMAIN="" # Optional: ...
```

- [ ] **Step 4: Clean up ORG_NAME references in code**

In `src/lib/org-settings.ts`, change:
```typescript
orgName: process.env.ORG_NAME || 'uDown',
```
To:
```typescript
orgName: 'uDown',
```

In `src/lib/auth.ts`, in the `createUser` event, change:
```typescript
name: process.env.ORG_NAME || 'My Community',
```
To:
```typescript
name: 'My Community',
```

- [ ] **Step 5: Regenerate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 6: Verify and commit**

```bash
npx tsc --noEmit && npx vitest run
git add -A
git commit -m "feat: add onboardingComplete field, remove seed script and ORG_NAME/ORG_DOMAIN env vars"
```

---

### Task 2: Bootstrap Auth (First User Skips Whitelist)

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Add bootstrap check to signIn callback**

This change is already pending (uncommitted) in `src/lib/auth.ts`. If not present, add after `if (!user.email) return false`:

```typescript
      // Bootstrap: first user ever can sign in without whitelist and becomes org admin
      const userCount = await prisma.user.count()
      if (userCount === 0) return true
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: first user to sign in bypasses whitelist and becomes org admin"
```

---

### Task 3: Invite Email Template

**Files:**
- Create: `src/lib/notifications/invite-email.ts`

- [ ] **Step 1: Create the invite email function**

Write to `src/lib/notifications/invite-email.ts`:

```typescript
import { getOrgSettings } from '@/lib/org-settings'
import { sendEmail } from './send-email'
import { baseEmailHtml } from './templates'

export async function sendInviteEmail(email: string): Promise<void> {
  const org = await getOrgSettings()
  const base = process.env.AUTH_URL || 'http://localhost:3000'

  const textPrimary = '#f1f5f9'
  const accentColor = '#16a0ac'

  const subject = `You're invited to ${org.orgName}`
  const content = `
    <h2 style="margin:0 0 12px;font-size:20px;color:${textPrimary};">
      You're invited to ${org.orgName}
    </h2>
    <p style="margin:0 0 20px;font-size:14px;color:${textPrimary};">
      Sign in to join the community and see what's happening.
    </p>
    <a href="${base}/sign-in" style="display:inline-block;background-color:${accentColor};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
      Join ${org.orgName}
    </a>
  `

  const html = baseEmailHtml({ ...org, preheader: subject, content })

  await sendEmail({ to: email, subject, html })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/notifications/invite-email.ts
git commit -m "feat: add invite email template"
```

---

### Task 4: Onboarding Server Actions

**Files:**
- Create: `src/lib/actions/onboarding.ts`

- [ ] **Step 1: Create onboarding server actions**

Write to `src/lib/actions/onboarding.ts`:

```typescript
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isOrgAdmin } from '@/lib/permissions'
import { put } from '@vercel/blob'
import { sendInviteEmail } from '@/lib/notifications/invite-email'

async function requireOnboardingAdmin() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  const admin = await isOrgAdmin(session.user.id)
  if (!admin) throw new Error('Not an org admin')
  return session
}

export async function saveOrgSettings(formData: FormData) {
  const session = await requireOnboardingAdmin()

  const orgName = (formData.get('orgName') as string)?.trim()
  if (!orgName) throw new Error('Org name is required')

  const data: Record<string, unknown> = {
    orgName,
    primaryColor: (formData.get('primaryColor') as string) || '#003262',
    accentColor: (formData.get('accentColor') as string) || '#16a0ac',
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

  // Upsert OrgSettings
  const existing = await prisma.orgSettings.findFirst()
  if (existing) {
    await prisma.orgSettings.update({ where: { id: existing.id }, data })
  } else {
    await prisma.orgSettings.create({ data: data as Parameters<typeof prisma.orgSettings.create>[0]['data'] })
  }

  // Rename the default group to match org name
  const defaultGroup = await prisma.group.findFirst({ where: { isDefault: true } })
  if (defaultGroup) {
    await prisma.group.update({
      where: { id: defaultGroup.id },
      data: { name: orgName },
    })
  }

  revalidatePath('/onboarding')
  revalidatePath('/', 'layout')
}

export async function addOnboardingMembers(formData: FormData) {
  const session = await requireOnboardingAdmin()

  const emailsStr = (formData.get('emails') as string)?.trim()
  const domainEnabled = formData.get('domainEnabled') === 'true'
  const domain = (formData.get('domain') as string)?.trim()

  const addedEmails: string[] = []

  // Parse individual emails
  if (emailsStr) {
    const emails = emailsStr.split(/[,\n]/).map((e) => e.trim().toLowerCase()).filter(Boolean)
    for (const email of emails) {
      if (!email.includes('@')) continue
      await prisma.emailWhitelist.upsert({
        where: { email_type: { email, type: 'EMAIL' } },
        create: { email, type: 'EMAIL', addedById: session.user.id },
        update: {},
      })
      addedEmails.push(email)
    }
  }

  // Handle CSV upload
  const csv = formData.get('csv') as File | null
  if (csv && csv.size > 0) {
    const text = await csv.text()
    const csvEmails = text
      .split(/[,\n\r]+/)
      .map((e) => e.trim().toLowerCase().replace(/^["']|["']$/g, ''))
      .filter((e) => e.includes('@'))

    for (const email of csvEmails) {
      await prisma.emailWhitelist.upsert({
        where: { email_type: { email, type: 'EMAIL' } },
        create: { email, type: 'EMAIL', addedById: session.user.id },
        update: {},
      })
      addedEmails.push(email)
    }
  }

  // Handle domain wildcard
  if (domainEnabled && domain) {
    const cleanDomain = domain.replace(/^@/, '').toLowerCase()
    await prisma.emailWhitelist.upsert({
      where: { email_type: { email: cleanDomain, type: 'DOMAIN' } },
      create: { email: cleanDomain, type: 'DOMAIN', addedById: session.user.id },
      update: {},
    })
  }

  // Send invite emails (fire-and-forget)
  const uniqueEmails = [...new Set(addedEmails)]
  for (const email of uniqueEmails) {
    void sendInviteEmail(email).catch(console.error)
  }

  revalidatePath('/onboarding')
}

export async function createOnboardingGroup(formData: FormData) {
  const session = await requireOnboardingAdmin()

  const name = (formData.get('name') as string)?.trim()
  if (!name) throw new Error('Group name is required')

  const description = (formData.get('description') as string)?.trim()
  if (!description) throw new Error('Group description is required')

  const group = await prisma.group.create({
    data: {
      name,
      description,
      ownerId: session.user.id,
    },
  })

  await prisma.groupMember.create({
    data: {
      userId: session.user.id,
      groupId: group.id,
      role: 'ADMIN',
    },
  })

  revalidatePath('/onboarding')
}

export async function deleteOnboardingGroup(groupId: string) {
  await requireOnboardingAdmin()

  const group = await prisma.group.findUnique({ where: { id: groupId } })
  if (!group || group.isDefault) throw new Error('Cannot delete this group')

  await prisma.group.delete({ where: { id: groupId } })
  revalidatePath('/onboarding')
}

export async function completeOnboarding() {
  await requireOnboardingAdmin()

  const existing = await prisma.orgSettings.findFirst()
  if (!existing) throw new Error('Org settings not configured')

  await prisma.orgSettings.update({
    where: { id: existing.id },
    data: { onboardingComplete: true },
  })

  revalidatePath('/', 'layout')
  redirect('/feed')
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/onboarding.ts
git commit -m "feat: add onboarding server actions"
```

---

### Task 5: Onboarding Wizard UI

**Files:**
- Create: `src/app/(app)/onboarding/layout.tsx`, `src/app/(app)/onboarding/page.tsx`

- [ ] **Step 1: Create onboarding layout**

Write to `src/app/(app)/onboarding/layout.tsx`:

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isOrgAdmin } from '@/lib/permissions'
import { getOrgSettings } from '@/lib/org-settings'

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  // If onboarding is already complete, go to feed
  const org = await getOrgSettings()
  const settings = await (await import('@/lib/prisma')).prisma.orgSettings.findFirst()
  if (settings?.onboardingComplete) redirect('/feed')

  const admin = await isOrgAdmin(session.user.id)
  if (!admin) {
    // Non-admin during onboarding — show holding page
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center px-4">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Setting up...</h1>
          <p className="mt-2 text-[var(--text-secondary)]">
            The admin is setting up this community. Check back soon!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="mx-auto max-w-xl px-4 py-12">
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create onboarding wizard page**

Write to `src/app/(app)/onboarding/page.tsx`:

```typescript
import { prisma } from '@/lib/prisma'
import { getOrgSettings } from '@/lib/org-settings'
import { OnboardingWizard } from './wizard'

export default async function OnboardingPage() {
  const org = await getOrgSettings()
  const settings = await prisma.orgSettings.findFirst()

  const whitelist = await prisma.emailWhitelist.findMany({
    orderBy: { createdAt: 'desc' },
  })

  const groups = await prisma.group.findMany({
    where: { isDefault: false },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <OnboardingWizard
      orgSettings={{
        orgName: settings?.orgName || '',
        orgLogo: settings?.orgLogo || null,
        primaryColor: settings?.primaryColor || '#003262',
        accentColor: settings?.accentColor || '#16a0ac',
        hasSettings: !!settings,
      }}
      whitelistCount={whitelist.length}
      groups={groups.map((g) => ({ id: g.id, name: g.name, description: g.description }))}
    />
  )
}
```

- [ ] **Step 3: Create the wizard client component**

Write to `src/app/(app)/onboarding/wizard.tsx`:

```typescript
'use client'

import { useState, useTransition } from 'react'
import {
  saveOrgSettings,
  addOnboardingMembers,
  createOnboardingGroup,
  deleteOnboardingGroup,
  completeOnboarding,
} from '@/lib/actions/onboarding'

type Props = {
  orgSettings: {
    orgName: string
    orgLogo: string | null
    primaryColor: string
    accentColor: string
    hasSettings: boolean
  }
  whitelistCount: number
  groups: Array<{ id: string; name: string; description: string | null }>
}

export function OnboardingWizard({ orgSettings, whitelistCount, groups }: Props) {
  const [step, setStep] = useState(orgSettings.hasSettings ? 2 : 1)
  const [isPending, startTransition] = useTransition()

  return (
    <div className="space-y-8">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`h-2 w-8 rounded-full transition-colors ${
              s <= step ? 'bg-[var(--brand-accent)]' : 'bg-[var(--bg-surface)]'
            }`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Welcome to uDown</h1>
            <p className="mt-2 text-[var(--text-secondary)]">Let's set up your community</p>
          </div>

          <form
            action={(formData) => {
              startTransition(async () => {
                await saveOrgSettings(formData)
                setStep(2)
              })
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="orgName" className="block text-sm font-medium text-[var(--text-primary)]">
                Community name *
              </label>
              <input
                id="orgName"
                name="orgName"
                type="text"
                required
                defaultValue={orgSettings.orgName}
                placeholder="Berkeley/UCSF CPH Program"
                className="mt-1 w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
              />
            </div>

            <div>
              <label htmlFor="logo" className="block text-sm font-medium text-[var(--text-primary)]">
                Logo
              </label>
              {orgSettings.orgLogo && (
                <img src={orgSettings.orgLogo} alt="Logo" className="my-2 h-12 w-auto" />
              )}
              <label
                htmlFor="logo"
                className="mt-1 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-card)]"
              >
                Upload logo
              </label>
              <input id="logo" name="logo" type="file" accept="image/*" className="hidden" />
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
                  defaultValue={orgSettings.primaryColor}
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
                  defaultValue={orgSettings.accentColor}
                  className="mt-1 h-10 w-full cursor-pointer rounded-lg border border-[var(--bg-surface)]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-lg bg-[var(--brand-accent)] px-4 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? 'Saving...' : 'Continue'}
            </button>
          </form>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Add Members</h1>
            <p className="mt-2 text-[var(--text-secondary)]">
              Who should be able to join? They'll get an invite email.
              {whitelistCount > 0 && ` (${whitelistCount} added so far)`}
            </p>
          </div>

          <form
            action={(formData) => {
              startTransition(async () => {
                await addOnboardingMembers(formData)
              })
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="emails" className="block text-sm font-medium text-[var(--text-primary)]">
                Email addresses
              </label>
              <textarea
                id="emails"
                name="emails"
                rows={4}
                placeholder="alice@example.com, bob@example.com"
                className="mt-1 w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-secondary)] text-sm focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
              />
            </div>

            <div>
              <label
                htmlFor="csv"
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-card)]"
              >
                Upload CSV
              </label>
              <input id="csv" name="csv" type="file" accept=".csv,text/csv" className="hidden" />
            </div>

            <div className="rounded-lg bg-[var(--bg-card)] p-3 space-y-2">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="domainEnabled"
                  value="true"
                  className="h-4 w-4 rounded border-[var(--bg-surface)] text-[var(--brand-accent)]"
                />
                <span className="text-sm text-[var(--text-primary)]">Allow anyone from a domain to join</span>
              </label>
              <input
                name="domain"
                type="text"
                placeholder="berkeley.edu"
                className="w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-[var(--brand-accent)] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-lg bg-[var(--brand-accent)] px-4 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? 'Adding...' : 'Add & Send Invites'}
            </button>
          </form>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 rounded-lg bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)]"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex-1 rounded-lg bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
            >
              {whitelistCount > 0 ? 'Continue' : 'Skip for now'}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Create Groups</h1>
            <p className="mt-2 text-[var(--text-secondary)]">
              What do people in your community do together?
            </p>
          </div>

          <form
            action={(formData) => {
              startTransition(async () => {
                await createOnboardingGroup(formData)
              })
            }}
            className="space-y-3"
          >
            <input
              name="name"
              type="text"
              required
              placeholder="Group name (e.g. Hikers, Book Club)"
              className="w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-secondary)] text-sm focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
            />
            <input
              name="description"
              type="text"
              required
              placeholder="What's this group about?"
              className="w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-secondary)] text-sm focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
            />
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-lg bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-card)] disabled:opacity-50"
            >
              {isPending ? 'Creating...' : 'Add Group'}
            </button>
          </form>

          {groups.length > 0 && (
            <div className="space-y-2">
              {groups.map((g) => (
                <div key={g.id} className="flex items-center justify-between rounded-lg bg-[var(--bg-card)] px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{g.name}</p>
                    {g.description && (
                      <p className="text-xs text-[var(--text-secondary)]">{g.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => startTransition(() => deleteOnboardingGroup(g.id))}
                    disabled={isPending}
                    className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="flex-1 rounded-lg bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)]"
            >
              Back
            </button>
            <button
              onClick={() => setStep(4)}
              className="flex-1 rounded-lg bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
            >
              {groups.length > 0 ? 'Continue' : 'Skip for now'}
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6 text-center">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">You're all set!</h1>
          <div className="space-y-2 text-sm text-[var(--text-secondary)]">
            {whitelistCount > 0 && <p>{whitelistCount} members invited</p>}
            {groups.length > 0 && <p>{groups.length} group{groups.length !== 1 ? 's' : ''} created</p>}
          </div>
          <form action={() => startTransition(() => completeOnboarding())}>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-[var(--brand-accent)] px-8 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? 'Finishing...' : 'Go to your community'}
            </button>
          </form>
          <button
            onClick={() => setStep(3)}
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Go back
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/onboarding/
git commit -m "feat: add onboarding wizard UI with 4-step setup flow"
```

---

### Task 6: Route Guard + OrgSettings Update

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/lib/org-settings.ts`

- [ ] **Step 1: Add onboarding route guard to app layout**

In `src/app/(app)/layout.tsx`, after the session check and before the Header render, add:

```typescript
  // Check if onboarding is complete
  const settings = await prisma.orgSettings.findFirst()
  const onboardingComplete = settings?.onboardingComplete ?? false

  // If not complete and not already on /onboarding, redirect
  if (!onboardingComplete) {
    const isOnboardingRoute = true // layout doesn't know the route, but onboarding has its own layout
    // Only redirect if this is NOT the onboarding page
    // We need to check the URL — use a different approach
  }
```

Actually, the cleaner approach: the onboarding layout already checks if onboarding is complete and redirects to /feed if so. We just need the app layout to redirect TO /onboarding if not complete. But since the onboarding pages are INSIDE (app), they share this layout.

The fix: check `onboardingComplete` in the app layout, and if false, DON'T render the Header or redirect — let the onboarding layout handle its own chrome. We can do this by adding `onboardingComplete` to the org settings return type.

Update `src/lib/org-settings.ts` to also return `onboardingComplete`:

```typescript
export type OrgSettingsData = {
  orgName: string
  orgLogo: string | null
  primaryColor: string
  accentColor: string
  fromEmail: string | null
  fromName: string | null
  onboardingComplete: boolean
}
```

And in the function, add:
```typescript
  onboardingComplete: settings?.onboardingComplete ?? false,
```

(In both the try block return and the defaults return with `onboardingComplete: false`.)

Then in `src/app/(app)/layout.tsx`, after getting org settings:

```typescript
  if (!org.onboardingComplete) {
    // During onboarding, render children without the header/nav
    // (the onboarding layout provides its own chrome)
    return <>{children}</>
  }
```

This means during onboarding, the app layout just passes through to the onboarding layout without the header.

- [ ] **Step 2: Add import for prisma in org-settings if needed**

The `getOrgSettings` function already imports prisma. Just update the return type and add the field.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/layout.tsx src/lib/org-settings.ts
git commit -m "feat: add onboarding route guard — skip header until setup complete"
```

---

### Task 7: Hook Invite Emails into Admin Whitelist

**Files:**
- Modify: `src/lib/actions/admin.ts`

- [ ] **Step 1: Send invite email when adding whitelist entries via admin dashboard**

In `src/lib/actions/admin.ts`, in `addWhitelistEntry`, after the for loop that adds entries, send invite emails:

```typescript
import { sendInviteEmail } from '@/lib/notifications/invite-email'

// After the for loop in addWhitelistEntry:
// Send invite emails for individual email entries (not domains)
for (const entry of entries) {
  if (entry.includes('@')) {
    void sendInviteEmail(entry).catch(console.error)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/admin.ts
git commit -m "feat: send invite email when adding members via admin whitelist"
```

---

### Task 8: End-to-End Verification

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Verify in browser**

Reset the database to simulate a fresh deployment:

```bash
npx prisma migrate reset --force
```

Then `npm run dev` and verify:

1. **First sign-in** — should work without whitelist, user becomes org admin
2. **Redirect to onboarding** — not the feed
3. **Step 1: Org Settings** — set name, pick colors, optionally upload logo. Required to continue.
4. **Step 2: Add Members** — paste emails, see "Add & Send Invites" button. Check console for invite email logs. Skip option works.
5. **Step 3: Create Groups** — create a group, see it listed, delete works. Skip option works.
6. **Step 4: Done** — shows summary, "Go to your community" completes onboarding
7. **Feed loads normally** — header shows org name, no more onboarding redirect
8. **Admin dashboard** — whitelist shows any emails added during onboarding

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: complete onboarding wizard"
```
