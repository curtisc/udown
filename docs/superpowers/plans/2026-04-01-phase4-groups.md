# Phase 4: Groups — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build subgroup creation, browsing, joining/leaving, member management, group-scoped events, and navigation — enabling ad-hoc communities within the org.

**Architecture:** Server actions for all group mutations. Group detail page shows a filtered event feed + member list. Event creation gets a group selector when the user belongs to multiple groups. Navigation added to header. Org admins have implicit admin rights on all groups via a shared permission helper.

**Tech Stack:** Next.js 16, TypeScript, Tailwind v4, Prisma v7, Vitest

**Codebase notes:**
- Schema already has Group, GroupMember models — no migrations needed
- Feed query already filters by group membership — works automatically
- Per-group notification prefs already built in settings page
- Default group created on first sign-in via `auth.ts` createUser event
- Event creation currently hardcodes to default group — needs group selection added

---

## File Map

**New files:**
```
src/lib/permissions.ts                       # isGroupAdmin, isOrgAdmin helpers
src/__tests__/lib/permissions.test.ts        # Permission logic tests
src/lib/actions/groups.ts                    # Group CRUD + membership actions
src/components/groups/group-card.tsx         # Group card for browse page
src/components/groups/member-list.tsx        # Member list with role badges
src/app/(app)/groups/page.tsx               # Browse groups
src/app/(app)/groups/new/page.tsx           # Create group
src/app/(app)/groups/[id]/page.tsx          # Group detail (events + members)
src/app/(app)/groups/[id]/settings/page.tsx # Group settings (admin only)
```

**Modified files:**
```
src/components/layout/header.tsx             # Add Feed/Groups nav links
src/components/events/event-form.tsx         # Add group selector
src/lib/actions/events.ts                    # Accept groupId from form
src/app/(app)/events/new/page.tsx            # Pass user's groups to form
```

---

### Task 1: Permission Helpers (TDD)

**Files:**
- Create: `src/lib/permissions.ts`, `src/__tests__/lib/permissions.test.ts`

- [ ] **Step 1: Write the failing tests**

Write to `src/__tests__/lib/permissions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { checkGroupAdmin, checkCanEditGroup } from '@/lib/permissions'

describe('checkGroupAdmin', () => {
  it('returns true when user is ADMIN of the group', () => {
    expect(checkGroupAdmin({ memberRole: 'ADMIN', orgAdminRole: null })).toBe(true)
  })

  it('returns true when user is org admin (ADMIN of default group)', () => {
    expect(checkGroupAdmin({ memberRole: 'MEMBER', orgAdminRole: 'ADMIN' })).toBe(true)
  })

  it('returns true when user is org admin even if not a member of the group', () => {
    expect(checkGroupAdmin({ memberRole: null, orgAdminRole: 'ADMIN' })).toBe(true)
  })

  it('returns false when user is regular member', () => {
    expect(checkGroupAdmin({ memberRole: 'MEMBER', orgAdminRole: 'MEMBER' })).toBe(false)
  })

  it('returns false when user has no membership', () => {
    expect(checkGroupAdmin({ memberRole: null, orgAdminRole: null })).toBe(false)
  })
})

describe('checkCanEditGroup', () => {
  it('returns false for the default group (cannot be edited)', () => {
    expect(checkCanEditGroup({ isDefault: true, isAdmin: true })).toBe(false)
  })

  it('returns true for non-default group when user is admin', () => {
    expect(checkCanEditGroup({ isDefault: false, isAdmin: true })).toBe(true)
  })

  it('returns false for non-default group when user is not admin', () => {
    expect(checkCanEditGroup({ isDefault: false, isAdmin: false })).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/lib/permissions.test.ts
```

- [ ] **Step 3: Write the implementation**

Write to `src/lib/permissions.ts`:

```typescript
type GroupMemberRole = 'MEMBER' | 'ADMIN'

export function checkGroupAdmin(params: {
  memberRole: GroupMemberRole | null
  orgAdminRole: GroupMemberRole | null
}): boolean {
  return params.memberRole === 'ADMIN' || params.orgAdminRole === 'ADMIN'
}

export function checkCanEditGroup(params: {
  isDefault: boolean
  isAdmin: boolean
}): boolean {
  if (params.isDefault) return false
  return params.isAdmin
}

export async function isGroupAdmin(userId: string, groupId: string): Promise<boolean> {
  const { prisma } = await import('@/lib/prisma')

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  })

  const defaultGroup = await prisma.group.findFirst({
    where: { isDefault: true },
  })

  let orgAdminRole: GroupMemberRole | null = null
  if (defaultGroup) {
    const orgMembership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId: defaultGroup.id } },
    })
    orgAdminRole = orgMembership?.role ?? null
  }

  return checkGroupAdmin({
    memberRole: membership?.role ?? null,
    orgAdminRole,
  })
}

export async function isOrgAdmin(userId: string): Promise<boolean> {
  const { prisma } = await import('@/lib/prisma')

  const defaultGroup = await prisma.group.findFirst({
    where: { isDefault: true },
  })
  if (!defaultGroup) return false

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId: defaultGroup.id } },
  })

  return membership?.role === 'ADMIN'
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/__tests__/lib/permissions.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/permissions.ts src/__tests__/lib/permissions.test.ts
git commit -m "feat: add group permission helpers"
```

---

### Task 2: Group Server Actions

**Files:**
- Create: `src/lib/actions/groups.ts`

- [ ] **Step 1: Create group CRUD and membership actions**

Write to `src/lib/actions/groups.ts`:

```typescript
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { isGroupAdmin } from '@/lib/permissions'

export async function createGroup(formData: FormData) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const name = formData.get('name') as string
  if (!name?.trim()) throw new Error('Name is required')

  const group = await prisma.group.create({
    data: {
      name: name.trim(),
      description: (formData.get('description') as string)?.trim() || null,
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

  revalidatePath('/groups')
  redirect(`/groups/${group.id}`)
}

export async function updateGroup(groupId: string, formData: FormData) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const group = await prisma.group.findUnique({ where: { id: groupId } })
  if (!group) throw new Error('Group not found')
  if (group.isDefault) throw new Error('Cannot edit the default group')

  const canEdit = await isGroupAdmin(session.user.id, groupId)
  if (!canEdit) throw new Error('Not authorized')

  const name = formData.get('name') as string
  if (!name?.trim()) throw new Error('Name is required')

  await prisma.group.update({
    where: { id: groupId },
    data: {
      name: name.trim(),
      description: (formData.get('description') as string)?.trim() || null,
    },
  })

  revalidatePath(`/groups/${groupId}`)
  revalidatePath('/groups')
  redirect(`/groups/${groupId}/settings`)
}

export async function deleteGroup(groupId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const group = await prisma.group.findUnique({ where: { id: groupId } })
  if (!group) throw new Error('Group not found')
  if (group.isDefault) throw new Error('Cannot delete the default group')

  const canEdit = await isGroupAdmin(session.user.id, groupId)
  if (!canEdit) throw new Error('Not authorized')

  await prisma.group.delete({ where: { id: groupId } })

  revalidatePath('/groups')
  redirect('/groups')
}

export async function joinGroup(groupId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const existing = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  })
  if (existing) return // already a member

  await prisma.groupMember.create({
    data: {
      userId: session.user.id,
      groupId,
      role: 'MEMBER',
    },
  })

  revalidatePath(`/groups/${groupId}`)
  revalidatePath('/groups')
  revalidatePath('/feed')
}

export async function leaveGroup(groupId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const group = await prisma.group.findUnique({ where: { id: groupId } })
  if (!group) throw new Error('Group not found')
  if (group.isDefault) throw new Error('Cannot leave the default group')
  if (group.ownerId === session.user.id) throw new Error('Owner cannot leave. Transfer ownership first.')

  await prisma.groupMember.deleteMany({
    where: { userId: session.user.id, groupId },
  })

  // Also remove notification prefs for this group
  await prisma.notificationPreference.deleteMany({
    where: { userId: session.user.id, groupId },
  })

  revalidatePath(`/groups/${groupId}`)
  revalidatePath('/groups')
  revalidatePath('/feed')
  redirect('/groups')
}

export async function removeMember(groupId: string, targetUserId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const canEdit = await isGroupAdmin(session.user.id, groupId)
  if (!canEdit) throw new Error('Not authorized')

  const group = await prisma.group.findUnique({ where: { id: groupId } })
  if (group?.ownerId === targetUserId) throw new Error('Cannot remove the group owner')

  await prisma.groupMember.deleteMany({
    where: { userId: targetUserId, groupId },
  })

  await prisma.notificationPreference.deleteMany({
    where: { userId: targetUserId, groupId },
  })

  revalidatePath(`/groups/${groupId}`)
}

export async function promoteMember(groupId: string, targetUserId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const canEdit = await isGroupAdmin(session.user.id, groupId)
  if (!canEdit) throw new Error('Not authorized')

  await prisma.groupMember.update({
    where: { userId_groupId: { userId: targetUserId, groupId } },
    data: { role: 'ADMIN' },
  })

  revalidatePath(`/groups/${groupId}`)
}

export async function demoteMember(groupId: string, targetUserId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const group = await prisma.group.findUnique({ where: { id: groupId } })
  if (group?.ownerId === targetUserId) throw new Error('Cannot demote the group owner')

  const canEdit = await isGroupAdmin(session.user.id, groupId)
  if (!canEdit) throw new Error('Not authorized')

  await prisma.groupMember.update({
    where: { userId_groupId: { userId: targetUserId, groupId } },
    data: { role: 'MEMBER' },
  })

  revalidatePath(`/groups/${groupId}`)
}

export async function transferOwnership(groupId: string, newOwnerId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const group = await prisma.group.findUnique({ where: { id: groupId } })
  if (!group) throw new Error('Group not found')
  if (group.ownerId !== session.user.id) throw new Error('Only the owner can transfer ownership')

  // New owner must be an admin
  const newOwnerMembership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: newOwnerId, groupId } },
  })
  if (newOwnerMembership?.role !== 'ADMIN') throw new Error('New owner must be an admin')

  await prisma.group.update({
    where: { id: groupId },
    data: { ownerId: newOwnerId },
  })

  revalidatePath(`/groups/${groupId}`)
}
```

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/groups.ts
git commit -m "feat: add group CRUD and membership server actions"
```

---

### Task 3: Group Card Component

**Files:**
- Create: `src/components/groups/group-card.tsx`

- [ ] **Step 1: Create the group card**

Write to `src/components/groups/group-card.tsx`:

```typescript
import Link from 'next/link'

type GroupCardProps = {
  group: {
    id: string
    name: string
    description: string | null
    isDefault: boolean
    _count: { members: number; events: number }
  }
  isMember: boolean
}

export function GroupCard({ group, isMember }: GroupCardProps) {
  return (
    <Link
      href={`/groups/${group.id}`}
      className="block rounded-xl bg-[var(--bg-card)] p-4 transition-colors hover:bg-[var(--bg-surface)]"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-[var(--text-primary)] truncate">
              {group.name}
            </h3>
            {group.isDefault && (
              <span className="shrink-0 rounded-full bg-[var(--brand-accent)]/20 px-2 py-0.5 text-xs font-medium text-[var(--brand-accent)]">
                Main
              </span>
            )}
          </div>
          {group.description && (
            <p className="mt-1 text-sm text-[var(--text-secondary)] line-clamp-2">
              {group.description}
            </p>
          )}
        </div>
        {isMember && (
          <span className="ml-2 shrink-0 rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
            Joined
          </span>
        )}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-[var(--text-secondary)]">
        <span>{group._count.members} member{group._count.members !== 1 ? 's' : ''}</span>
        <span>{group._count.events} event{group._count.events !== 1 ? 's' : ''}</span>
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/groups/group-card.tsx
git commit -m "feat: add group card component"
```

---

### Task 4: Member List Component

**Files:**
- Create: `src/components/groups/member-list.tsx`

- [ ] **Step 1: Create the member list**

Write to `src/components/groups/member-list.tsx`:

```typescript
'use client'

import { useTransition } from 'react'
import { promoteMember, demoteMember, removeMember } from '@/lib/actions/groups'

type Member = {
  userId: string
  role: 'MEMBER' | 'ADMIN'
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

type MemberListProps = {
  groupId: string
  ownerId: string
  members: Member[]
  currentUserId: string
  isAdmin: boolean
  isDefault: boolean
}

export function MemberList({
  groupId,
  ownerId,
  members,
  currentUserId,
  isAdmin,
  isDefault,
}: MemberListProps) {
  const [isPending, startTransition] = useTransition()

  const sorted = [...members].sort((a, b) => {
    if (a.userId === ownerId) return -1
    if (b.userId === ownerId) return 1
    if (a.role === 'ADMIN' && b.role !== 'ADMIN') return -1
    if (a.role !== 'ADMIN' && b.role === 'ADMIN') return 1
    return 0
  })

  return (
    <div className="space-y-2">
      {sorted.map((m) => {
        const isOwner = m.userId === ownerId
        const isSelf = m.userId === currentUserId
        const canManage = isAdmin && !isSelf && !isOwner

        return (
          <div
            key={m.userId}
            className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-[var(--bg-surface)]"
          >
            <div className="flex items-center gap-2">
              {m.user.image ? (
                <img
                  src={m.user.image}
                  alt={m.user.name || ''}
                  className="h-8 w-8 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-surface)] text-sm font-bold text-[var(--text-secondary)]">
                  {(m.user.name || '?')[0].toUpperCase()}
                </div>
              )}
              <div>
                <span className="text-sm text-[var(--text-primary)]">
                  {m.user.name || m.user.email}
                </span>
                {isSelf && (
                  <span className="ml-1 text-xs text-[var(--text-secondary)]">(you)</span>
                )}
              </div>
              {isOwner && (
                <span className="rounded-full bg-[var(--brand-accent)]/20 px-2 py-0.5 text-xs font-medium text-[var(--brand-accent)]">
                  Owner
                </span>
              )}
              {!isOwner && m.role === 'ADMIN' && (
                <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-400">
                  Admin
                </span>
              )}
            </div>

            {canManage && (
              <div className="flex gap-1">
                {m.role === 'MEMBER' ? (
                  <button
                    onClick={() => startTransition(() => promoteMember(groupId, m.userId))}
                    disabled={isPending}
                    className="rounded px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)] disabled:opacity-50"
                  >
                    Make Admin
                  </button>
                ) : (
                  <button
                    onClick={() => startTransition(() => demoteMember(groupId, m.userId))}
                    disabled={isPending}
                    className="rounded px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)] disabled:opacity-50"
                  >
                    Remove Admin
                  </button>
                )}
                {!isDefault && (
                  <button
                    onClick={() => startTransition(() => removeMember(groupId, m.userId))}
                    disabled={isPending}
                    className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/groups/member-list.tsx
git commit -m "feat: add member list component with admin controls"
```

---

### Task 5: Browse Groups Page

**Files:**
- Create: `src/app/(app)/groups/page.tsx`

- [ ] **Step 1: Create the groups browse page**

Write to `src/app/(app)/groups/page.tsx`:

```typescript
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GroupCard } from '@/components/groups/group-card'
import Link from 'next/link'

export default async function GroupsPage() {
  const session = await auth()
  if (!session?.user) return null

  const groups = await prisma.group.findMany({
    include: {
      _count: { select: { members: true, events: true } },
    },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  })

  const userMemberships = await prisma.groupMember.findMany({
    where: { userId: session.user.id },
    select: { groupId: true },
  })
  const memberGroupIds = new Set(userMemberships.map((m) => m.groupId))

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Groups</h2>
        <Link
          href="/groups/new"
          className="rounded-lg bg-[var(--brand-accent)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          New Group
        </Link>
      </div>

      <div className="space-y-3">
        {groups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            isMember={memberGroupIds.has(group.id)}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/groups/page.tsx
git commit -m "feat: add groups browse page"
```

---

### Task 6: Create Group Page

**Files:**
- Create: `src/app/(app)/groups/new/page.tsx`

- [ ] **Step 1: Create the new group page**

Write to `src/app/(app)/groups/new/page.tsx`:

```typescript
import { createGroup } from '@/lib/actions/groups'
import Link from 'next/link'

export default function NewGroupPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">New Group</h2>
        <Link
          href="/groups"
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Cancel
        </Link>
      </div>
      <form action={createGroup} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-[var(--text-primary)]">
            Group name *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="Hikers, Board Game Crew, etc."
            className="mt-1 w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
          />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-[var(--text-primary)]">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            placeholder="What's this group about?"
            className="mt-1 w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-[var(--brand-accent)] px-4 py-3 font-semibold text-white transition-opacity hover:opacity-90"
        >
          Create Group
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/groups/new/
git commit -m "feat: add create group page"
```

---

### Task 7: Group Detail Page

**Files:**
- Create: `src/app/(app)/groups/[id]/page.tsx`

- [ ] **Step 1: Create the group detail page**

Write to `src/app/(app)/groups/[id]/page.tsx`:

```typescript
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { EventCard } from '@/components/events/event-card'
import { MemberList } from '@/components/groups/member-list'
import { joinGroup, leaveGroup } from '@/lib/actions/groups'
import { isGroupAdmin } from '@/lib/permissions'

type Props = {
  params: Promise<{ id: string }>
}

export default async function GroupDetailPage({ params }: Props) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) return null

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
  })
  if (!group) notFound()

  const membership = group.members.find((m) => m.userId === session.user.id)
  const isMember = !!membership
  const adminStatus = await isGroupAdmin(session.user.id, id)

  const now = new Date()
  const events = isMember
    ? await prisma.event.findMany({
        where: { groupId: id, dateTime: { gte: now } },
        include: {
          rsvps: {
            include: { user: { select: { id: true, name: true, image: true } } },
          },
        },
        orderBy: { dateTime: 'asc' },
      })
    : []

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/groups"
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          &larr; All groups
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">{group.name}</h2>
            {group.isDefault && (
              <span className="rounded-full bg-[var(--brand-accent)]/20 px-2 py-0.5 text-xs font-medium text-[var(--brand-accent)]">
                Main
              </span>
            )}
          </div>
          {group.description && (
            <p className="mt-1 text-[var(--text-secondary)]">{group.description}</p>
          )}
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {group.members.length} member{group.members.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex gap-2">
          {!isMember && (
            <form action={async () => { 'use server'; await joinGroup(id) }}>
              <button
                type="submit"
                className="rounded-lg bg-[var(--brand-accent)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Join
              </button>
            </form>
          )}
          {isMember && !group.isDefault && group.ownerId !== session.user.id && (
            <form action={async () => { 'use server'; await leaveGroup(id) }}>
              <button
                type="submit"
                className="rounded-lg bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                Leave
              </button>
            </form>
          )}
          {adminStatus && !group.isDefault && (
            <Link
              href={`/groups/${id}/settings`}
              className="rounded-lg bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              Settings
            </Link>
          )}
        </div>
      </div>

      {/* Events */}
      {isMember && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--text-secondary)]">Upcoming Events</h3>
            <Link
              href={`/events/new?groupId=${id}`}
              className="text-sm text-[var(--brand-accent)] hover:underline"
            >
              New Event
            </Link>
          </div>
          {events.length > 0 ? (
            <div className="space-y-3">
              {events.map((event) => (
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
            <p className="py-6 text-center text-sm text-[var(--text-secondary)]">
              No upcoming events in this group.
            </p>
          )}
        </div>
      )}

      {/* Members */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Members</h3>
        <MemberList
          groupId={id}
          ownerId={group.ownerId}
          members={group.members.map((m) => ({
            userId: m.userId,
            role: m.role as 'MEMBER' | 'ADMIN',
            user: m.user,
          }))}
          currentUserId={session.user.id}
          isAdmin={adminStatus}
          isDefault={group.isDefault}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/groups/\[id\]/page.tsx
git commit -m "feat: add group detail page with events and members"
```

---

### Task 8: Group Settings Page

**Files:**
- Create: `src/app/(app)/groups/[id]/settings/page.tsx`

- [ ] **Step 1: Create the group settings page**

Write to `src/app/(app)/groups/[id]/settings/page.tsx`:

```typescript
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { updateGroup, deleteGroup } from '@/lib/actions/groups'
import { isGroupAdmin } from '@/lib/permissions'

type Props = {
  params: Promise<{ id: string }>
}

export default async function GroupSettingsPage({ params }: Props) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const group = await prisma.group.findUnique({ where: { id } })
  if (!group) notFound()
  if (group.isDefault) redirect(`/groups/${id}`)

  const adminStatus = await isGroupAdmin(session.user.id, id)
  if (!adminStatus) redirect(`/groups/${id}`)

  const boundUpdateGroup = updateGroup.bind(null, group.id)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Group Settings</h2>
        <Link
          href={`/groups/${id}`}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Back to group
        </Link>
      </div>

      <form action={boundUpdateGroup} className="space-y-4 rounded-xl bg-[var(--bg-card)] p-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-[var(--text-primary)]">
            Group name *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={group.name}
            className="mt-1 w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
          />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-[var(--text-primary)]">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={group.description || ''}
            className="mt-1 w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-[var(--brand-accent)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Save Changes
        </button>
      </form>

      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
        <h3 className="mb-2 text-sm font-medium text-red-400">Danger Zone</h3>
        <p className="mb-3 text-sm text-[var(--text-secondary)]">
          Deleting this group will remove all its events and member data. This cannot be undone.
        </p>
        <form
          action={async () => {
            'use server'
            await deleteGroup(id)
          }}
        >
          <button
            type="submit"
            className="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30"
          >
            Delete Group
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/groups/\[id\]/settings/
git commit -m "feat: add group settings page with edit and delete"
```

---

### Task 9: Update Event Creation with Group Selection

**Files:**
- Modify: `src/components/events/event-form.tsx`, `src/lib/actions/events.ts`, `src/app/(app)/events/new/page.tsx`

- [ ] **Step 1: Add groupId to the event form**

In `src/components/events/event-form.tsx`, add a `groups` prop to `EventFormProps`:

```typescript
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
    groupId?: string
  }
  submitLabel: string
  groups?: Array<{ id: string; name: string }>
}
```

Add group selector as the first field in the form, before the title field. Only show it if `groups` has more than 1 entry:

```typescript
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
```

- [ ] **Step 2: Update createEvent action to use groupId from form**

In `src/lib/actions/events.ts`, modify `createEvent` to accept an optional `groupId` from the form instead of always using the default group:

Replace the default group lookup section with:

```typescript
  const groupId = formData.get('groupId') as string
  let targetGroupId: string

  if (groupId) {
    // Verify user is a member of this group
    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: session.user.id, groupId } },
    })
    if (!membership) throw new Error('Not a member of this group')
    targetGroupId = groupId
  } else {
    // Fallback to default group
    const defaultGroup = await prisma.group.findFirst({ where: { isDefault: true } })
    if (!defaultGroup) throw new Error('No default group found')
    targetGroupId = defaultGroup.id
  }
```

Then use `targetGroupId` in the `prisma.event.create` call and the group update:

```typescript
  groupId: targetGroupId,
```

And:

```typescript
  await prisma.group.update({
    where: { id: targetGroupId },
    data: { lastEventAt: new Date() },
  })
```

- [ ] **Step 3: Update the new event page to pass groups**

Replace `src/app/(app)/events/new/page.tsx`:

```typescript
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { createEvent } from '@/lib/actions/events'
import { EventForm } from '@/components/events/event-form'
import Link from 'next/link'

type Props = {
  searchParams: Promise<{ groupId?: string }>
}

export default async function NewEventPage({ searchParams }: Props) {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const { groupId } = await searchParams

  const memberships = await prisma.groupMember.findMany({
    where: { userId: session.user.id },
    include: { group: { select: { id: true, name: true } } },
    orderBy: { group: { isDefault: 'desc' } },
  })

  const groups = memberships.map((m) => m.group)

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
      <EventForm
        action={createEvent}
        submitLabel="Create Event"
        groups={groups}
        defaultValues={{ groupId: groupId || undefined }}
      />
    </div>
  )
}
```

- [ ] **Step 4: Verify no type errors and tests pass**

```bash
npx tsc --noEmit && npx vitest run
```

- [ ] **Step 5: Commit**

```bash
git add src/components/events/event-form.tsx src/lib/actions/events.ts src/app/\(app\)/events/new/page.tsx
git commit -m "feat: add group selection to event creation"
```

---

### Task 10: Add Navigation to Header

**Files:**
- Modify: `src/components/layout/header.tsx`

- [ ] **Step 1: Add Feed and Groups nav links**

Update the header to include navigation links between the org name and the user controls. Replace the header content with:

```typescript
import Link from 'next/link'
import { ThemeToggle } from './theme-toggle'

type HeaderProps = {
  userName?: string | null
  userImage?: string | null
  orgName: string
}

export function Header({ userName, userImage, orgName }: HeaderProps) {
  return (
    <header className="border-b border-[var(--bg-surface)] bg-[var(--bg-card)]">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/feed" className="text-lg font-bold text-[var(--brand-accent)]">
            {orgName}
          </Link>
          <nav className="flex gap-3">
            <Link
              href="/feed"
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Feed
            </Link>
            <Link
              href="/groups"
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Groups
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/settings">
            {userImage ? (
              <img
                src={userImage}
                alt={userName || ''}
                className="h-8 w-8 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-accent)] text-sm font-bold text-white">
                {(userName || '?')[0].toUpperCase()}
              </div>
            )}
          </Link>
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/header.tsx
git commit -m "feat: add Feed and Groups navigation to header"
```

---

### Task 11: End-to-End Verification

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Verify in browser**

Restart dev server and verify:

1. **Navigation** — Feed and Groups links visible in header
2. **Groups page** — shows default group with "Main" badge and member/event counts
3. **Create group** — click "New Group", enter name + description, submit. Redirected to new group page.
4. **Group detail** — shows group name, description, member list (you as owner/admin), events, join/leave/settings buttons
5. **Join/Leave** — from groups browse, click into a non-default group you're not in, click Join. Leave works too.
6. **Member management** — as admin, see promote/demote/remove buttons on other members
7. **Group settings** — edit name/description, save. Delete group.
8. **Event creation** — if you're in 2+ groups, see the group selector dropdown. Create event in a specific group, verify it shows on that group's page.
9. **Feed** — shows events from all groups you're a member of

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Phase 4 groups"
```
