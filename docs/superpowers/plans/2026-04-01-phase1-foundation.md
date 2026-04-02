# Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the Next.js project with Prisma schema, Auth.js authentication with email whitelist, dark/light theme system, and the sign-in/access-request flow — producing a deployable app skeleton.

**Architecture:** Next.js App Router with Server Components by default. Auth.js v5 with Prisma adapter and database sessions. Tailwind CSS with class-based dark mode and CSS custom properties for brand colors injected from OrgSettings. Route protection via middleware (cookie check) + server-side session validation in layouts.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Prisma, Auth.js v5, Vitest

---

## File Map

**New files:**
```
.env.example
vitest.config.ts
prisma/schema.prisma
prisma/seed.ts
src/types/next-auth.d.ts
src/lib/prisma.ts
src/lib/whitelist.ts
src/lib/auth-providers.ts
src/lib/auth.ts
src/lib/org-settings.ts
src/app/api/auth/[...nextauth]/route.ts
src/app/(auth)/sign-in/page.tsx
src/app/(auth)/request-access/page.tsx
src/app/(app)/layout.tsx
src/app/(app)/feed/page.tsx
src/components/layout/theme-provider.tsx
src/components/layout/theme-toggle.tsx
src/components/layout/header.tsx
src/middleware.ts
src/__tests__/lib/whitelist.test.ts
src/__tests__/lib/auth-providers.test.ts
```

**Modified files:**
```
.gitignore                  (add .superpowers/)
tailwind.config.ts          (dark mode, brand colors)
src/app/globals.css         (theme variables)
src/app/layout.tsx          (providers, theme injection)
src/app/page.tsx            (redirect to /feed)
package.json                (test script, prisma seed)
```

---

### Task 1: Project Scaffold & Configuration

**Files:**
- Create: `.env.example`, `vitest.config.ts`
- Modify: `package.json`, `.gitignore`

- [ ] **Step 1: Create Next.js project**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

Answer prompts: Yes to all defaults. Since the directory already has files (CLAUDE.md, README.md), this may ask to overwrite — proceed.

- [ ] **Step 2: Install dependencies**

```bash
npm install next-auth@5 @auth/prisma-adapter @prisma/client resend @vercel/blob
npm install -D prisma vitest @vitejs/plugin-react tsx
```

- [ ] **Step 3: Create .env.example**

Write to `.env.example`:

```env
# Required
DATABASE_URL="postgresql://user:password@host:5432/udown?sslmode=require"
AUTH_SECRET="" # Generate with: openssl rand -base64 32
AUTH_URL="http://localhost:3000"

# Org configuration
ORG_NAME="My Community"
ORG_DOMAIN="" # Optional: seeds whitelist with domain (e.g. berkeley.edu)

# Auth providers (at least one required — uncomment and fill in)
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""
# AUTH_GITHUB_ID=""
# AUTH_GITHUB_SECRET=""
# AUTH_APPLE_ID=""
# AUTH_APPLE_SECRET=""
# AUTH_EMAIL_ENABLED="true"

# Optional
# NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=""
# RESEND_API_KEY=""
# RESEND_FROM_EMAIL="events@yourdomain.com"
```

- [ ] **Step 4: Create vitest.config.ts**

Write to `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 5: Add test script and seed config to package.json**

Add to `package.json` scripts:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

- [ ] **Step 6: Update .gitignore**

Append to `.gitignore`:

```
.superpowers/
.env
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with dependencies"
```

---

### Task 2: Prisma Schema

**Files:**
- Create: `prisma/schema.prisma`

- [ ] **Step 1: Initialize Prisma**

```bash
npx prisma init
```

- [ ] **Step 2: Write the full schema**

Write to `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================
// Auth.js adapter models
// ============================================================

model User {
  id                 String    @id @default(cuid())
  name               String?
  email              String    @unique
  emailVerified      DateTime?
  image              String?
  phone              String?
  emailNotifications Boolean   @default(true)
  smsNotifications   Boolean   @default(false)
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  accounts               Account[]
  sessions               Session[]
  ownedGroups            Group[]                @relation("GroupOwner")
  groupMemberships       GroupMember[]
  createdEvents          Event[]                @relation("EventCreator")
  createdEventSeries     EventSeries[]          @relation("SeriesCreator")
  rsvps                  RSVP[]
  notificationPrefs      NotificationPreference[]
  whitelistEntriesAdded  EmailWhitelist[]       @relation("WhitelistAddedBy")
  accessRequestResponses AccessRequest[]        @relation("AccessRequestResponder")
  activityLogs           ActivityLog[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ============================================================
// Access control
// ============================================================

model EmailWhitelist {
  id        String             @id @default(cuid())
  email     String
  type      EmailWhitelistType
  addedById String?
  createdAt DateTime           @default(now())

  addedBy User? @relation("WhitelistAddedBy", fields: [addedById], references: [id])

  @@unique([email, type])
}

enum EmailWhitelistType {
  EMAIL
  DOMAIN
}

model AccessRequest {
  id            String              @id @default(cuid())
  name          String
  email         String
  image         String?
  status        AccessRequestStatus @default(PENDING)
  respondedById String?
  respondedAt   DateTime?
  createdAt     DateTime            @default(now())

  respondedBy User? @relation("AccessRequestResponder", fields: [respondedById], references: [id])
}

enum AccessRequestStatus {
  PENDING
  APPROVED
  DENIED
}

// ============================================================
// Groups & membership
// ============================================================

model Group {
  id                      String    @id @default(cuid())
  name                    String
  description             String?
  image                   String?
  isDefault               Boolean   @default(false)
  ownerId                 String
  lastEventAt             DateTime?
  lastNudgeSentAt         DateTime?
  inactivityThresholdDays Int       @default(30)
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt

  owner             User                   @relation("GroupOwner", fields: [ownerId], references: [id])
  members           GroupMember[]
  events            Event[]
  eventSeries       EventSeries[]
  notificationPrefs NotificationPreference[]
}

model GroupMember {
  id       String         @id @default(cuid())
  userId   String
  groupId  String
  role     GroupMemberRole @default(MEMBER)
  joinedAt DateTime       @default(now())

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  group Group @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@unique([userId, groupId])
}

enum GroupMemberRole {
  MEMBER
  ADMIN
}

// ============================================================
// Events & RSVPs
// ============================================================

model Event {
  id             String    @id @default(cuid())
  title          String
  description    String?
  dateTime       DateTime
  endTime        DateTime?
  placeName      String?
  placeAddress   String?
  placeLat       Float?
  placeLng       Float?
  placeId        String?
  estimatedCost  Decimal?
  capacity       Int?
  groupId        String
  createdById    String
  seriesId       String?
  isModified     Boolean   @default(false)
  reminderSentAt DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  group     Group        @relation(fields: [groupId], references: [id], onDelete: Cascade)
  createdBy User         @relation("EventCreator", fields: [createdById], references: [id])
  series    EventSeries? @relation(fields: [seriesId], references: [id], onDelete: SetNull)
  rsvps     RSVP[]
  tags      EventTag[]
}

model EventSeries {
  id              String     @id @default(cuid())
  groupId         String
  createdById     String
  recurrence      Recurrence
  dayOfWeek       Int
  timeOfDay       String
  durationMinutes Int?
  title           String
  description     String?
  placeName       String?
  placeAddress    String?
  placeLat        Float?
  placeLng        Float?
  placeId         String?
  estimatedCost   Decimal?
  capacity        Int?
  tagIds          String[]
  startsAt        DateTime
  endsAt          DateTime?
  skippedDates    DateTime[]
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  group     Group   @relation(fields: [groupId], references: [id], onDelete: Cascade)
  createdBy User    @relation("SeriesCreator", fields: [createdById], references: [id])
  events    Event[]
}

enum Recurrence {
  WEEKLY
  BIWEEKLY
  MONTHLY
}

model RSVP {
  id         String     @id @default(cuid())
  userId     String
  eventId    String
  status     RSVPStatus
  guestCount Int        @default(0)
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  event Event @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@unique([userId, eventId])
}

enum RSVPStatus {
  DOWN
  MAYBE
  NOT_DOWN
}

// ============================================================
// Tags
// ============================================================

model Tag {
  id   String @id @default(cuid())
  name String @unique
  slug String @unique

  events EventTag[]
}

model EventTag {
  eventId String
  tagId   String

  event Event @relation(fields: [eventId], references: [id], onDelete: Cascade)
  tag   Tag   @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([eventId, tagId])
}

// ============================================================
// Notifications
// ============================================================

model NotificationPreference {
  id             String              @id @default(cuid())
  userId         String
  groupId        String
  newEvents      Boolean             @default(true)
  eventUpdates   Boolean             @default(true)
  eventReminders Boolean             @default(true)
  rsvpMilestones Boolean             @default(true)
  channel        NotificationChannel @default(EMAIL)

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  group Group @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@unique([userId, groupId])
}

enum NotificationChannel {
  EMAIL
  SMS
  BOTH
  OFF
}

// ============================================================
// Org settings (singleton)
// ============================================================

model OrgSettings {
  id                        String   @id @default(cuid())
  orgName                   String
  orgLogo                   String?
  primaryColor              String   @default("#003262")
  accentColor               String   @default("#16a0ac")
  fromEmail                 String?
  fromName                  String?
  defaultEmailNotifications Boolean  @default(true)
  defaultSmsNotifications   Boolean  @default(false)
  updatedAt                 DateTime @updatedAt
}

// ============================================================
// Activity log
// ============================================================

model ActivityLog {
  id         String         @id @default(cuid())
  actorId    String
  action     ActivityAction
  targetType ActivityTarget
  targetId   String
  metadata   Json
  createdAt  DateTime       @default(now())

  actor User @relation(fields: [actorId], references: [id])
}

enum ActivityAction {
  USER_JOINED
  EVENT_CREATED
  EVENT_UPDATED
  EVENT_DELETED
  RSVP_CREATED
  RSVP_UPDATED
  GROUP_CREATED
  GROUP_JOINED
  GROUP_LEFT
  MEMBER_REMOVED
  ACCESS_REQUESTED
  ACCESS_APPROVED
  ACCESS_DENIED
  SETTINGS_UPDATED
}

enum ActivityTarget {
  USER
  EVENT
  GROUP
  SETTINGS
}
```

- [ ] **Step 3: Generate Prisma client and create migration**

```bash
npx prisma generate
npx prisma migrate dev --name init
```

Expected: Migration created successfully, client generated.

- [ ] **Step 4: Commit**

```bash
git add prisma/ src/
git commit -m "feat: add full Prisma schema with all models"
```

---

### Task 3: Prisma Client Singleton

**Files:**
- Create: `src/lib/prisma.ts`

- [ ] **Step 1: Create Prisma client singleton**

Write to `src/lib/prisma.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/prisma.ts
git commit -m "feat: add Prisma client singleton"
```

---

### Task 4: Whitelist Check Utility (TDD)

**Files:**
- Create: `src/lib/whitelist.ts`, `src/__tests__/lib/whitelist.test.ts`

- [ ] **Step 1: Write the failing tests**

Write to `src/__tests__/lib/whitelist.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { checkEmailAgainstWhitelist, type WhitelistEntry } from '@/lib/whitelist'

describe('checkEmailAgainstWhitelist', () => {
  const entries: WhitelistEntry[] = [
    { email: 'alice@example.com', type: 'EMAIL' },
    { email: 'berkeley.edu', type: 'DOMAIN' },
  ]

  it('returns true for exact email match', () => {
    expect(checkEmailAgainstWhitelist('alice@example.com', entries)).toBe(true)
  })

  it('returns true for case-insensitive email match', () => {
    expect(checkEmailAgainstWhitelist('Alice@Example.COM', entries)).toBe(true)
  })

  it('returns true for domain match', () => {
    expect(checkEmailAgainstWhitelist('bob@berkeley.edu', entries)).toBe(true)
  })

  it('returns true for case-insensitive domain match', () => {
    expect(checkEmailAgainstWhitelist('bob@Berkeley.EDU', entries)).toBe(true)
  })

  it('returns false for non-matching email', () => {
    expect(checkEmailAgainstWhitelist('bob@other.com', entries)).toBe(false)
  })

  it('returns false for empty whitelist', () => {
    expect(checkEmailAgainstWhitelist('alice@example.com', [])).toBe(false)
  })

  it('returns false for partial domain match', () => {
    expect(checkEmailAgainstWhitelist('bob@notberkeley.edu', entries)).toBe(false)
  })

  it('returns false for subdomain of whitelisted domain', () => {
    expect(checkEmailAgainstWhitelist('bob@sub.berkeley.edu', entries)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/lib/whitelist.test.ts
```

Expected: FAIL — module `@/lib/whitelist` not found.

- [ ] **Step 3: Write the implementation**

Write to `src/lib/whitelist.ts`:

```typescript
import { prisma } from './prisma'

export type WhitelistEntry = {
  email: string
  type: 'EMAIL' | 'DOMAIN'
}

export function checkEmailAgainstWhitelist(
  email: string,
  entries: WhitelistEntry[]
): boolean {
  const normalizedEmail = email.toLowerCase()
  const domain = normalizedEmail.split('@')[1]

  return entries.some((entry) => {
    if (entry.type === 'EMAIL') {
      return entry.email.toLowerCase() === normalizedEmail
    }
    if (entry.type === 'DOMAIN') {
      return domain === entry.email.toLowerCase()
    }
    return false
  })
}

export async function isWhitelisted(email: string): Promise<boolean> {
  const entries = await prisma.emailWhitelist.findMany({
    select: { email: true, type: true },
  })
  return checkEmailAgainstWhitelist(email, entries)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/lib/whitelist.test.ts
```

Expected: 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/whitelist.ts src/__tests__/lib/whitelist.test.ts
git commit -m "feat: add email whitelist check with domain support"
```

---

### Task 5: Auth Provider Configuration (TDD)

**Files:**
- Create: `src/lib/auth-providers.ts`, `src/__tests__/lib/auth-providers.test.ts`

- [ ] **Step 1: Write the failing tests**

Write to `src/__tests__/lib/auth-providers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { getEnabledProviderIds } from '@/lib/auth-providers'

describe('getEnabledProviderIds', () => {
  it('returns empty array when no providers configured', () => {
    expect(getEnabledProviderIds({})).toEqual([])
  })

  it('includes google when both credentials present', () => {
    const env = { AUTH_GOOGLE_ID: 'id', AUTH_GOOGLE_SECRET: 'secret' }
    expect(getEnabledProviderIds(env)).toContain('google')
  })

  it('excludes google when only ID present', () => {
    const env = { AUTH_GOOGLE_ID: 'id' }
    expect(getEnabledProviderIds(env)).not.toContain('google')
  })

  it('includes github when both credentials present', () => {
    const env = { AUTH_GITHUB_ID: 'id', AUTH_GITHUB_SECRET: 'secret' }
    expect(getEnabledProviderIds(env)).toContain('github')
  })

  it('excludes github when only secret present', () => {
    const env = { AUTH_GITHUB_SECRET: 'secret' }
    expect(getEnabledProviderIds(env)).not.toContain('github')
  })

  it('includes apple when both credentials present', () => {
    const env = { AUTH_APPLE_ID: 'id', AUTH_APPLE_SECRET: 'secret' }
    expect(getEnabledProviderIds(env)).toContain('apple')
  })

  it('includes resend when enabled flag and API key present', () => {
    const env = { AUTH_EMAIL_ENABLED: 'true', RESEND_API_KEY: 'key' }
    expect(getEnabledProviderIds(env)).toContain('resend')
  })

  it('excludes resend when enabled flag is not "true"', () => {
    const env = { AUTH_EMAIL_ENABLED: 'false', RESEND_API_KEY: 'key' }
    expect(getEnabledProviderIds(env)).not.toContain('resend')
  })

  it('excludes resend when API key missing', () => {
    const env = { AUTH_EMAIL_ENABLED: 'true' }
    expect(getEnabledProviderIds(env)).not.toContain('resend')
  })

  it('includes multiple providers simultaneously', () => {
    const env = {
      AUTH_GOOGLE_ID: 'id',
      AUTH_GOOGLE_SECRET: 'secret',
      AUTH_GITHUB_ID: 'id',
      AUTH_GITHUB_SECRET: 'secret',
    }
    const ids = getEnabledProviderIds(env)
    expect(ids).toEqual(['google', 'github'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/lib/auth-providers.test.ts
```

Expected: FAIL — module `@/lib/auth-providers` not found.

- [ ] **Step 3: Write the implementation**

Write to `src/lib/auth-providers.ts`:

```typescript
import Google from 'next-auth/providers/google'
import GitHub from 'next-auth/providers/github'
import Apple from 'next-auth/providers/apple'
import Resend from 'next-auth/providers/resend'
import type { Provider } from 'next-auth/providers'

export function getEnabledProviderIds(
  env: Record<string, string | undefined>
): string[] {
  const ids: string[] = []
  if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) ids.push('google')
  if (env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET) ids.push('github')
  if (env.AUTH_APPLE_ID && env.AUTH_APPLE_SECRET) ids.push('apple')
  if (env.AUTH_EMAIL_ENABLED === 'true' && env.RESEND_API_KEY) ids.push('resend')
  return ids
}

export function getProviders(): Provider[] {
  const providers: Provider[] = []

  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push(Google)
  }
  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(GitHub)
  }
  if (process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET) {
    providers.push(Apple)
  }
  if (process.env.AUTH_EMAIL_ENABLED === 'true' && process.env.RESEND_API_KEY) {
    providers.push(
      Resend({
        apiKey: process.env.RESEND_API_KEY,
        from: process.env.RESEND_FROM_EMAIL || 'noreply@example.com',
      })
    )
  }

  return providers
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/lib/auth-providers.test.ts
```

Expected: 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth-providers.ts src/__tests__/lib/auth-providers.test.ts
git commit -m "feat: add dynamic auth provider configuration"
```

---

### Task 6: Auth.js Setup

**Files:**
- Create: `src/lib/auth.ts`, `src/types/next-auth.d.ts`, `src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Create type augmentation for session**

Write to `src/types/next-auth.d.ts`:

```typescript
import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}
```

- [ ] **Step 2: Create Auth.js configuration**

Write to `src/lib/auth.ts`:

```typescript
import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'
import { getProviders } from './auth-providers'
import { isWhitelisted } from './whitelist'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: getProviders(),
  pages: {
    signIn: '/sign-in',
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false

      const whitelisted = await isWhitelisted(user.email)

      if (!whitelisted) {
        // Create a pending access request (skip if one already exists)
        const existing = await prisma.accessRequest.findFirst({
          where: { email: user.email, status: 'PENDING' },
        })
        if (!existing) {
          await prisma.accessRequest.create({
            data: {
              name: user.name || 'Unknown',
              email: user.email,
              image: user.image || null,
              status: 'PENDING',
            },
          })
        }
        // Redirect to the access request confirmation page
        return `/request-access?email=${encodeURIComponent(user.email)}`
      }

      return true
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
      }
      return session
    },
  },
  events: {
    async createUser({ user }) {
      // On first-ever sign-up, create the default org group with this user as owner.
      // For subsequent sign-ups, add the user as a member of the default group.
      let defaultGroup = await prisma.group.findFirst({
        where: { isDefault: true },
      })

      if (!defaultGroup) {
        defaultGroup = await prisma.group.create({
          data: {
            name: process.env.ORG_NAME || 'My Community',
            isDefault: true,
            ownerId: user.id!,
          },
        })
        await prisma.groupMember.create({
          data: {
            userId: user.id!,
            groupId: defaultGroup.id,
            role: 'ADMIN',
          },
        })
      } else {
        await prisma.groupMember.create({
          data: {
            userId: user.id!,
            groupId: defaultGroup.id,
            role: 'MEMBER',
          },
        })
      }
    },
  },
})
```

- [ ] **Step 3: Create the Auth.js route handler**

Create directory structure, then write to `src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import { handlers } from '@/lib/auth'

export const { GET, POST } = handlers
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth.ts src/types/next-auth.d.ts src/app/api/auth/
git commit -m "feat: configure Auth.js with Prisma adapter and whitelist check"
```

---

### Task 7: Theme System

**Files:**
- Modify: `tailwind.config.ts`, `src/app/globals.css`
- Create: `src/components/layout/theme-provider.tsx`, `src/components/layout/theme-toggle.tsx`

- [ ] **Step 1: Update Tailwind config for dark mode and brand colors**

Replace `tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'var(--brand-primary)',
          accent: 'var(--brand-accent)',
        },
        surface: {
          primary: 'var(--bg-primary)',
          card: 'var(--bg-card)',
          elevated: 'var(--bg-surface)',
        },
      },
    },
  },
  plugins: [],
}
export default config
```

- [ ] **Step 2: Update globals.css with theme variables**

Replace `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --bg-primary: #ffffff;
    --bg-card: #f8fafc;
    --bg-surface: #f1f5f9;
    --text-primary: #0f172a;
    --text-secondary: #64748b;
    --brand-primary: #003262;
    --brand-accent: #16a0ac;
  }

  .dark {
    --bg-primary: #0f0f1a;
    --bg-card: #1a1a2e;
    --bg-surface: #252540;
    --text-primary: #f1f5f9;
    --text-secondary: #94a3b8;
  }
}

body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color 0.2s, color 0.2s;
}
```

- [ ] **Step 3: Create ThemeProvider**

Write to `src/components/layout/theme-provider.tsx`:

```typescript
'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

type Theme = 'light' | 'dark' | 'system'

type ThemeContextType = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  setTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system')

  // Read stored preference on mount
  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null
    if (stored) setTheme(stored)
  }, [])

  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement

    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', isDark)
      localStorage.removeItem('theme')
    } else {
      root.classList.toggle('dark', theme === 'dark')
      localStorage.setItem('theme', theme)
    }
  }, [theme])

  // Listen for OS theme changes when in "system" mode
  useEffect(() => {
    if (theme !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('dark', e.matches)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
```

- [ ] **Step 4: Create ThemeToggle**

Write to `src/components/layout/theme-toggle.tsx`:

```typescript
'use client'

import { useTheme } from './theme-provider'

const labels: Record<string, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'Auto',
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const cycle = () => {
    if (theme === 'system') setTheme('dark')
    else if (theme === 'dark') setTheme('light')
    else setTheme('system')
  }

  return (
    <button
      onClick={cycle}
      className="rounded-lg px-2 py-1 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors"
      aria-label={`Theme: ${theme}. Click to change.`}
    >
      {labels[theme]}
    </button>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.ts src/app/globals.css src/components/layout/
git commit -m "feat: add dark/light theme system with brand color tokens"
```

---

### Task 8: OrgSettings Loader

**Files:**
- Create: `src/lib/org-settings.ts`

- [ ] **Step 1: Create OrgSettings loader with env var fallbacks**

Write to `src/lib/org-settings.ts`:

```typescript
import { prisma } from './prisma'

export type OrgSettingsData = {
  orgName: string
  orgLogo: string | null
  primaryColor: string
  accentColor: string
  fromEmail: string | null
  fromName: string | null
}

export async function getOrgSettings(): Promise<OrgSettingsData> {
  const defaults: OrgSettingsData = {
    orgName: process.env.ORG_NAME || 'uDown',
    orgLogo: null,
    primaryColor: '#003262',
    accentColor: '#16a0ac',
    fromEmail: process.env.RESEND_FROM_EMAIL || null,
    fromName: null,
  }

  try {
    const settings = await prisma.orgSettings.findFirst()
    if (!settings) return defaults

    return {
      orgName: settings.orgName || defaults.orgName,
      orgLogo: settings.orgLogo,
      primaryColor: settings.primaryColor || defaults.primaryColor,
      accentColor: settings.accentColor || defaults.accentColor,
      fromEmail: settings.fromEmail || defaults.fromEmail,
      fromName: settings.fromName,
    }
  } catch {
    // Database not yet migrated — return defaults
    return defaults
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/org-settings.ts
git commit -m "feat: add OrgSettings loader with env var fallbacks"
```

---

### Task 9: Root Layout & App Layout

**Files:**
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `src/app/(app)/layout.tsx`, `src/app/(app)/feed/page.tsx`, `src/components/layout/header.tsx`

- [ ] **Step 1: Create the Header component**

Write to `src/components/layout/header.tsx`:

```typescript
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
        <h1 className="text-lg font-bold text-[var(--brand-accent)]">
          {orgName}
        </h1>
        <div className="flex items-center gap-3">
          <ThemeToggle />
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
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Update root layout**

Replace `src/app/layout.tsx`:

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { getOrgSettings } from '@/lib/org-settings'

const inter = Inter({ subsets: ['latin'] })

export async function generateMetadata(): Promise<Metadata> {
  const org = await getOrgSettings()
  return {
    title: org.orgName,
    description: `${org.orgName} - see what's happening`,
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const org = await getOrgSettings()

  return (
    <html
      lang="en"
      suppressHydrationWarning
      style={
        {
          '--brand-primary': org.primaryColor,
          '--brand-accent': org.accentColor,
        } as React.CSSProperties
      }
    >
      <head>
        {/* Inline script prevents flash of wrong theme before React hydrates */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')})()`,
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
```

Note: The inline `<script>` is a hardcoded string (no user input) — this is the standard pattern for preventing theme flash (FOUC). It runs before React hydrates and sets the `dark` class immediately based on localStorage or system preference.

- [ ] **Step 3: Update root page to redirect to feed**

Replace `src/app/page.tsx`:

```typescript
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/feed')
}
```

- [ ] **Step 4: Create authenticated app layout**

Write to `src/app/(app)/layout.tsx`:

```typescript
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { getOrgSettings } from '@/lib/org-settings'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const org = await getOrgSettings()

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Header
        userName={session.user.name}
        userImage={session.user.image}
        orgName={org.orgName}
      />
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 5: Create placeholder feed page**

Write to `src/app/(app)/feed/page.tsx`:

```typescript
export default function FeedPage() {
  return (
    <div className="py-12 text-center">
      <h2 className="text-xl font-bold text-[var(--text-primary)]">
        No events yet
      </h2>
      <p className="mt-2 text-[var(--text-secondary)]">
        Events from your groups will show up here.
      </p>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/ src/components/layout/header.tsx
git commit -m "feat: add root layout, app layout with header, and feed placeholder"
```

---

### Task 10: Sign-In Page

**Files:**
- Create: `src/app/(auth)/sign-in/page.tsx`

- [ ] **Step 1: Create the sign-in page**

Write to `src/app/(auth)/sign-in/page.tsx`:

```typescript
import { signIn } from '@/lib/auth'
import { getOrgSettings } from '@/lib/org-settings'
import { getEnabledProviderIds } from '@/lib/auth-providers'

const providerMeta: Record<string, { name: string; bg: string; text: string }> =
  {
    google: { name: 'Google', bg: '#4285F4', text: '#ffffff' },
    github: { name: 'GitHub', bg: '#24292e', text: '#ffffff' },
    apple: { name: 'Apple', bg: '#000000', text: '#ffffff' },
    resend: { name: 'Email Magic Link', bg: '#16a0ac', text: '#ffffff' },
  }

export default async function SignInPage() {
  const org = await getOrgSettings()
  const providerIds = getEnabledProviderIds(process.env)

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
      <div className="w-full max-w-sm space-y-8 px-4">
        {org.orgLogo && (
          <img
            src={org.orgLogo}
            alt={org.orgName}
            className="mx-auto h-16 w-auto"
          />
        )}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            {org.orgName}
          </h1>
          <p className="mt-2 text-[var(--text-secondary)]">
            Sign in to see what&apos;s happening
          </p>
        </div>
        <div className="space-y-3">
          {providerIds.map((id) => {
            const meta = providerMeta[id]
            if (!meta) return null
            return (
              <form
                key={id}
                action={async () => {
                  'use server'
                  await signIn(id, { redirectTo: '/feed' })
                }}
              >
                <button
                  type="submit"
                  className="flex w-full items-center justify-center rounded-lg px-4 py-3 font-semibold transition-opacity hover:opacity-90"
                  style={{ backgroundColor: meta.bg, color: meta.text }}
                >
                  Sign in with {meta.name}
                </button>
              </form>
            )
          })}
        </div>
        {providerIds.length === 0 && (
          <p className="text-center text-sm text-[var(--text-secondary)]">
            No auth providers configured. Set provider credentials in your
            environment variables.
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(auth\)/
git commit -m "feat: add sign-in page with dynamic provider buttons"
```

---

### Task 11: Access Request Page

**Files:**
- Create: `src/app/(auth)/request-access/page.tsx`

- [ ] **Step 1: Create the access request confirmation page**

Write to `src/app/(auth)/request-access/page.tsx`:

```typescript
type Props = {
  searchParams: Promise<{ email?: string }>
}

export default async function RequestAccessPage({ searchParams }: Props) {
  const { email } = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
      <div className="w-full max-w-sm space-y-6 px-4 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg-surface)]">
          <svg
            className="h-8 w-8 text-[var(--brand-accent)]"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Request Sent
        </h1>
        <p className="text-[var(--text-secondary)]">
          {email
            ? `We've notified the admins about your request for ${email}.`
            : "We've notified the admins about your request."}{' '}
          You&apos;ll get an email when you&apos;re approved.
        </p>
        <a
          href="/sign-in"
          className="inline-block text-[var(--brand-accent)] hover:underline"
        >
          Back to sign in
        </a>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(auth\)/request-access/
git commit -m "feat: add access request confirmation page"
```

---

### Task 12: Route Protection Middleware

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create middleware**

Write to `src/middleware.ts`:

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Check for Auth.js session cookie
  // Cookie name varies: "authjs.session-token" in dev, "__Secure-authjs.session-token" in production
  const sessionToken =
    request.cookies.get('authjs.session-token') ||
    request.cookies.get('__Secure-authjs.session-token')

  if (!sessionToken) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /sign-in, /request-access (auth pages)
     * - /api/auth (Auth.js routes)
     * - /api/cron (Vercel Cron routes)
     * - /api/access-request (approval links)
     * - /_next (Next.js internals)
     * - /favicon.ico
     */
    '/((?!sign-in|request-access|api/auth|api/cron|api/access-request|_next/static|_next/image|favicon.ico).*)',
  ],
}
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add route protection middleware"
```

---

### Task 13: Seed Script

**Files:**
- Create: `prisma/seed.ts`

- [ ] **Step 1: Create seed script**

Write to `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Seed whitelist domain if ORG_DOMAIN is set
  const orgDomain = process.env.ORG_DOMAIN
  if (orgDomain) {
    await prisma.emailWhitelist.upsert({
      where: {
        email_type: { email: orgDomain, type: 'DOMAIN' },
      },
      create: { email: orgDomain, type: 'DOMAIN' },
      update: {},
    })
    console.log(`Seeded whitelist domain: @${orgDomain}`)
  } else {
    console.log('No ORG_DOMAIN set, skipping whitelist domain seed')
  }

  // Create OrgSettings singleton if it does not exist
  const existingSettings = await prisma.orgSettings.findFirst()
  if (!existingSettings) {
    await prisma.orgSettings.create({
      data: {
        orgName: process.env.ORG_NAME || 'My Community',
        primaryColor: '#003262',
        accentColor: '#16a0ac',
        fromEmail: process.env.RESEND_FROM_EMAIL || null,
      },
    })
    console.log('Created default org settings')
  } else {
    console.log('Org settings already exist, skipping')
  }

  console.log('Seed complete')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

Note: The default org group is NOT created in the seed. It is created dynamically when the first user signs in (see `events.createUser` in `src/lib/auth.ts`). This avoids needing a placeholder owner ID.

- [ ] **Step 2: Run the seed**

```bash
npx prisma db seed
```

Expected output (varies based on env vars):
```
Seeded whitelist domain: @berkeley.edu
Created default org settings
Seed complete
```

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: add seed script for whitelist domain and org settings"
```

---

### Task 14: End-to-End Verification

- [ ] **Step 1: Create .env from .env.example and fill in values**

```bash
cp .env.example .env
```

Fill in:
- `DATABASE_URL` — Neon connection string
- `AUTH_SECRET` — run `openssl rand -base64 32` and paste the result
- `ORG_NAME` — e.g. "Berkeley/UCSF CPH Program"
- `ORG_DOMAIN` — e.g. "berkeley.edu" (optional, seeds whitelist)
- `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET` — from Google Cloud Console

- [ ] **Step 2: Run migrations and seed**

```bash
npx prisma migrate dev
npx prisma db seed
```

- [ ] **Step 3: Start dev server and verify**

```bash
npm run dev
```

Open `http://localhost:3000`. Verify:
- Redirected to `/sign-in`
- Org name displayed
- Google sign-in button visible (or whichever provider you configured)
- Clicking sign-in completes OAuth flow
- Whitelisted email: lands on `/feed` with header, theme toggle, avatar
- Non-whitelisted email: lands on `/request-access` with confirmation message

- [ ] **Step 4: Verify theme toggle**

Click the theme toggle in the header: Auto -> Dark -> Light -> Auto. Background and text should update smoothly.

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: 18 tests pass (8 whitelist + 10 provider config).

- [ ] **Step 6: Verify database state**

```bash
npx prisma studio
```

Check:
- `OrgSettings` has one row with your org name and default colors
- `EmailWhitelist` has your domain entry (if `ORG_DOMAIN` was set)
- `User` has your user record (after signing in)
- `Group` has the default group with `isDefault: true` (created on first sign-in)
- `GroupMember` links your user to the default group as ADMIN

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: complete Phase 1 foundation"
```

---

## Notes for Subsequent Phases

This plan covers Phase 1 only. Remaining phases will each get their own plan document:

- **Phase 2: Events Core** — Event CRUD, RSVP with guest count, event feed UI
- **Phase 3: Notifications** — Resend integration, email templates, notification preferences, cron job
- **Phase 4: Groups** — Subgroup CRUD, membership, per-group notification prefs
- **Phase 5: Admin Dashboard** — Whitelist management, access request approve/deny, org settings UI, activity feed
- **Phase 6: Polish** — Google Places autocomplete, tags/filtering, recurring events (EventSeries), inactivity nudges
