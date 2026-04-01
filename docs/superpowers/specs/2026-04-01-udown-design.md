# uDown — Design Spec

## Overview

uDown is an open source, web-based social event coordination platform for small communities (10-100 people). Anyone in a group can post events and anyone else can join. The goal is to improve in-person social interactions and allow ad-hoc subgroups to form organically.

The codebase is fully generic — all instance-specific configuration is driven by environment variables and an admin UI. Each deployment (university, church group, hobby community) forks the repo, sets env vars, and deploys.

The first deployment target is cphsocial.com for the Berkeley/UCSF Computational Precision Health program (~34 students).

## Tech Stack

- **Framework**: Next.js (App Router) with TypeScript
- **ORM**: Prisma
- **Database**: Neon (serverless Postgres)
- **Auth**: Auth.js (NextAuth v5) with configurable providers
- **Hosting**: Vercel
- **Styling**: Tailwind CSS
- **Location**: Google Places API (Autocomplete) via `@react-google-maps/api`
- **Email**: Resend (transactional email for notifications)
- **File Storage**: Vercel Blob (org logo upload)
- **SMS**: Twilio (schema-ready, not built in v1)

## Build Strategy

Vertical slices — each phase produces a deployable app:

1. **Foundation** — Next.js scaffold, Prisma schema, Auth.js + whitelist, dark/light theme system
2. **Events core** — Default group, event CRUD, RSVP with +N guests, event feed
3. **Notifications** — Email via Resend, notification preferences (email-only), 24hr reminder cron
4. **Groups** — Subgroup CRUD, membership, per-group notification prefs
5. **Admin** — Whitelist management, access request flow, org settings/branding, activity feed
6. **Polish** — Google Places autocomplete, tags/filtering, recurring events, inactivity nudges, edge cases

## Data Model

### User

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| name | String? | From OAuth profile |
| email | String (unique) | From OAuth profile |
| emailVerified | DateTime? | Auth.js managed |
| image | String? | Avatar URL from OAuth |
| phone | String? | For future SMS support |
| emailNotifications | Boolean (default true) | Global email toggle |
| smsNotifications | Boolean (default false) | Global SMS toggle (unused in v1) |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### Account, Session, VerificationToken

Standard Auth.js adapter tables — managed by Auth.js Prisma adapter.

### EmailWhitelist

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | |
| email | String | Individual email or domain (e.g. `berkeley.edu`) |
| type | Enum: EMAIL, DOMAIN | |
| addedById | String? | User who added it (null for env var seed) |
| createdAt | DateTime | |

### AccessRequest

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | |
| name | String | From OAuth profile |
| email | String | |
| image | String? | Avatar from OAuth |
| status | Enum: PENDING, APPROVED, DENIED | |
| respondedById | String? | Admin who approved/denied |
| respondedAt | DateTime? | |
| createdAt | DateTime | |

### Group

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | |
| name | String | |
| description | String? | |
| image | String? | Group avatar/image |
| isDefault | Boolean (default false) | Only one group has this true |
| ownerId | String | Creator, used as reply-to on emails |
| lastEventAt | DateTime? | Tracks activity for nudge notifications |
| lastNudgeSentAt | DateTime? | Prevents duplicate nudges |
| inactivityThresholdDays | Int (default 30) | Configurable per group |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### GroupMember

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | |
| userId | String | |
| groupId | String | |
| role | Enum: MEMBER, ADMIN | Owner is ADMIN + Group.ownerId |
| joinedAt | DateTime | When the user joined this group |

Unique constraint on (userId, groupId).

### Event

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | |
| title | String | |
| description | String? | |
| dateTime | DateTime | Start time |
| endTime | DateTime? | Optional end time |
| placeName | String? | From Google Places |
| placeAddress | String? | Formatted address |
| placeLat | Float? | Latitude |
| placeLng | Float? | Longitude |
| placeId | String? | Google Place ID |
| estimatedCost | Decimal? | Per-person cost estimate |
| capacity | Int? | Optional max attendees |
| groupId | String | Which group this event belongs to |
| createdById | String | User who created it |
| seriesId | String? | Links to EventSeries if recurring |
| isModified | Boolean (default false) | True if this instance was individually edited |
| reminderSentAt | DateTime? | Tracks whether 24hr reminder was sent |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### EventSeries

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | |
| groupId | String | |
| createdById | String | |
| recurrence | Enum: WEEKLY, BIWEEKLY, MONTHLY | |
| dayOfWeek | Int | 0=Sunday through 6=Saturday |
| timeOfDay | String | HH:mm format |
| durationMinutes | Int? | Duration — used to set endTime on generated instances |
| title | String | Template title |
| description | String? | Template description |
| placeName | String? | Template location fields |
| placeAddress | String? | |
| placeLat | Float? | |
| placeLng | Float? | |
| placeId | String? | |
| estimatedCost | Decimal? | |
| capacity | Int? | |
| startsAt | DateTime | When the series begins |
| endsAt | DateTime? | Optional end date (null = indefinite) |
| skippedDates | DateTime[] | Dates where a single instance was deleted |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### RSVP

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | |
| userId | String | |
| eventId | String | |
| status | Enum: DOWN, MAYBE, NOT_DOWN | |
| guestCount | Int (default 0) | Number of additional guests |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Unique constraint on (userId, eventId).

### Tag

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | |
| name | String (unique) | Display name (e.g. "Outdoors") |
| slug | String (unique) | URL-friendly (e.g. "outdoors") |

### EventTag

| Field | Type | Notes |
|-------|------|-------|
| eventId | String | |
| tagId | String | |

Composite primary key on (eventId, tagId).

### NotificationPreference

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | |
| userId | String | |
| groupId | String | |
| newEvents | Boolean (default true) | |
| eventUpdates | Boolean (default true) | |
| eventReminders | Boolean (default true) | |
| rsvpMilestones | Boolean (default true) | |
| channel | Enum: EMAIL, SMS, BOTH, OFF (default EMAIL) | Not exposed in v1 UI |

Unique constraint on (userId, groupId).

### OrgSettings

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Singleton — only one row |
| orgName | String | Falls back to `ORG_NAME` env var |
| orgLogo | String? | URL to uploaded image in Vercel Blob |
| primaryColor | String (default "#003262") | Brand primary color |
| accentColor | String (default "#16a0ac") | Brand accent color |
| fromEmail | String? | Falls back to `RESEND_FROM_EMAIL` env var |
| fromName | String? | Display name for notification emails |
| defaultEmailNotifications | Boolean (default true) | Default for new users |
| defaultSmsNotifications | Boolean (default false) | Default for new users |
| updatedAt | DateTime | |

### ActivityLog

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | |
| actorId | String | User who performed the action |
| action | Enum (see below) | What happened |
| targetType | Enum: USER, EVENT, GROUP, SETTINGS | What was acted on |
| targetId | String | ID of the target record |
| metadata | Json | Extra context for display (event title, group name, etc.) |
| createdAt | DateTime | |

**Action enum values:** USER_JOINED, EVENT_CREATED, EVENT_UPDATED, EVENT_DELETED, RSVP_CREATED, RSVP_UPDATED, GROUP_CREATED, GROUP_JOINED, GROUP_LEFT, MEMBER_REMOVED, ACCESS_REQUESTED, ACCESS_APPROVED, ACCESS_DENIED, SETTINGS_UPDATED

## Auth & Access Control

### Provider Configuration

Auth.js configured with dynamic providers based on environment variables:

- Google OAuth: enabled if `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are set
- GitHub OAuth: enabled if `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET` are set
- Apple OAuth: enabled if `AUTH_APPLE_ID` and `AUTH_APPLE_SECRET` are set
- Email Magic Link: enabled if `AUTH_EMAIL_ENABLED=true` and `RESEND_API_KEY` is set

The sign-in page dynamically renders only the enabled providers.

### Sign-in Flow

1. User hits the app → redirected to sign-in page (org logo, org name, provider buttons)
2. User authenticates via any enabled provider
3. Auth.js `signIn` callback checks email against EmailWhitelist:
   - **Exact match**: email exists in whitelist with type=EMAIL
   - **Domain match**: email domain matches a whitelist entry with type=DOMAIN
4. If whitelisted → create/update User → auto-add to default group → redirect to event feed
5. If NOT whitelisted → create AccessRequest (PENDING) → redirect to "request sent" page → email all org admins with one-click approve/deny links (signed URLs)
6. Approve link hits API route → adds email to whitelist → creates User → sends welcome email to requester

### Whitelist Seeding

On first app startup, if `ORG_DOMAIN` env var is set, seed the EmailWhitelist with a DOMAIN entry. Handled in Prisma seed script.

### Session Strategy

Database sessions via Prisma adapter (not JWT).

### Route Protection

Next.js middleware checks for valid session on all `/(app)` routes. Unauthenticated users redirect to sign-in. Public routes: `/(auth)/*`, `/api/auth/*`, `/api/access-request/approve/*`.

## Theme System

### Dark/Light Mode

- Tailwind `darkMode: 'class'` strategy
- Default: respect `prefers-color-scheme` from user's device
- User can override via toggle in the app header (stored in `localStorage`)

### Color Tokens

| Token | Light Mode | Dark Mode |
|-------|-----------|-----------|
| `--brand-primary` | From OrgSettings.primaryColor | From OrgSettings.primaryColor |
| `--brand-accent` | From OrgSettings.accentColor | From OrgSettings.accentColor (lightened) |
| `--bg-primary` | `#ffffff` | `#0f0f1a` |
| `--bg-card` | `#f8fafc` | `#1a1a2e` |
| `--bg-surface` | `#f1f5f9` | `#252540` |
| `--text-primary` | `#0f172a` | `#f1f5f9` |
| `--text-secondary` | `#64748b` | `#94a3b8` |

### Brand Customization

Org admins configure `primaryColor` and `accentColor` via color pickers in the admin dashboard. The root layout reads OrgSettings and injects them as CSS custom properties on `<html>`. All themed components reference `var(--brand-primary)` and `var(--brand-accent)`.

### Component Strategy

No component library. Tailwind utility classes with a small set of hand-built components: Button, Card, Input, Modal, Avatar, Toggle. Mobile-first responsive design.

## Events

### Event Creation

1. User taps "New Event" from the feed or group page
2. Form: title, description, date/time, end time (optional), location (Google Places autocomplete), estimated cost (optional), capacity (optional), tags (multi-select + create new)
3. If user is in multiple groups, select which group. Single-group users auto-assign.
4. Optional: "Make this recurring" toggle → reveals recurrence options (weekly, biweekly, monthly) with optional end date
5. Submit → server action creates Event (and EventSeries + 8 future instances if recurring) → triggers new event notification

### Event Feed (Home Screen)

- Chronological list of upcoming events across all user's groups
- Event card shows: title, date/time, location, cost (if set), group name (if multiple groups), attendee count (including guests), attendee avatars, user's RSVP status
- Past events drop off the feed (accessible via "Past Events" view)
- Filter by: group, tag

### RSVP

- Three-state toggle on event card: **"I'm Down"** / **"Maybe"** / **"Can't Make It"**
- No response = no RSVP record exists
- Selecting "I'm Down" or "Maybe" expands inline guest picker: "Bringing anyone? [0] [+][-]"
- Tapping the same status again removes the RSVP
- Attendee display: "8 down · 3 maybe" (counts include guest totals)

### Recurring Events (EventSeries)

- Toggle during event creation: "Make this recurring" → weekly / biweekly / monthly, optional end date
- Creates an EventSeries record + generates 8 individual Event instances ahead
- Each Event instance is fully editable independently

**Editing a recurring event instance prompts three options (Google Calendar pattern):**

1. **"This event only"** — edits the individual Event, sets `isModified: true`
2. **"This and future events"** — updates EventSeries template, regenerates future unmodified instances
3. **"All events"** — updates EventSeries template, overwrites all future instances (even modified ones). Past events untouched.

**Deleting a recurring event instance:**

1. **"This event only"** — deletes Event, adds date to `EventSeries.skippedDates`
2. **"This and future events"** — sets `EventSeries.endsAt` to this date, deletes future instances
3. **"All events"** — deletes series and all future instances (past events kept for history)

**Instance generation:** The cron job generates new instances as the 8-week window advances.

## Groups

### Default Org Group

- Auto-created on first startup using `ORG_NAME` env var, marked `isDefault: true`
- Cannot be deleted or left
- All new users auto-added as MEMBER on first sign-in
- First user becomes owner/admin

### Subgroups

- Any user can create a new group (name, description, optional image)
- Creator becomes owner (ADMIN role + Group.ownerId)
- Groups are visible to all org members — join is one-tap, no approval needed
- Admins can share invite links for discoverability

### Permissions

- **Group admin**: can edit group details, remove members, promote/demote admins, manage group settings
- **Org admin** (admin of default group): implicit admin rights on ALL groups without needing explicit ADMIN role on each one
- Permission check: `isGroupAdmin = user.role == ADMIN on this group OR user.role == ADMIN on default group`
- Owner can transfer ownership to another admin

### Group Page

- Group name, description, member count, member avatars
- Event feed filtered to that group
- "New Event" scoped to this group
- Members list with roles
- Settings (admins): edit details, manage members, notification preferences, inactivity threshold

## Notifications (Email-only v1)

### Triggers

| Trigger | Recipients | Content |
|---------|-----------|---------|
| New event posted | Group members (newEvents enabled) | Event title, date, location, cost, RSVP link |
| Event updated | Users RSVP'd DOWN or MAYBE | What changed, link to event |
| Event reminder (24hr) | Users RSVP'd DOWN | "Tomorrow: [Event] at [Time] at [Location]" |
| RSVP milestone | Group members (rsvpMilestones enabled) | "10 people are down for [Event]!" |
| Inactivity nudge | Group admins only | "[Group] hasn't had an event in N days" |
| Access request | Org admins | Requester details, one-click approve/deny links |
| Access approved | Requester | "You're in! Sign in to get started" |

### Email Design

- Dark-themed HTML emails matching the app aesthetic (dark background, light text, accent-colored CTA buttons)
- Org logo top-center, org name in header
- Styled with `primaryColor` and `accentColor` from OrgSettings
- Email-safe HTML/CSS (table layout, inline styles)
- Responsive for mobile email clients
- From: configurable address from OrgSettings (fallback to `RESEND_FROM_EMAIL`)
- Reply-To: group owner's email (org admin for system-level emails)
- Reusable email template component in `src/lib/notifications/`

### Notification Preferences (v1)

- **Global**: email notifications on/off toggle (User model)
- **Per-group**: toggle each type (new events, updates, reminders, milestones) on/off
- Channel field exists in schema (defaults to EMAIL) but is not exposed in the settings UI
- A notification is sent only if: global email is ON, AND per-group preference for that type is ON

### Cron Job

Single Vercel Cron hitting `/api/cron/notifications`, runs every hour:

1. Send 24hr event reminders (check `Event.reminderSentAt` to avoid duplicates)
2. Generate upcoming recurring event instances (maintain 8-week lookahead)
3. Check group inactivity and send admin nudges (check `Group.lastNudgeSentAt`)

## Admin Dashboard

Accessible only to org admins. Link in app header visible only to admins.

### Activity Feed (Landing Page)

- Reverse-chronological stream of ActivityLog entries
- Renders like: "**Curtis** created event **Park Hangout** in **Hikers**" with relative timestamps
- Filterable by action type and group
- Uses metadata JSON for display — no joins needed, works even if referenced records are deleted

### Whitelist Management

- Searchable list of all whitelisted emails and domains
- Add individual emails (single or comma-separated bulk)
- Add domain wildcards (e.g. `berkeley.edu`)
- CSV import (upload, preview, confirm)
- Remove individual entries
- Shows who added each entry and when

### Access Requests

- List of pending requests with name, email, avatar, timestamp
- One-click approve (adds to whitelist, creates user, sends welcome email)
- Deny button (updates status)
- History tab for past approved/denied requests

### Org Settings

- Org name (text input)
- Org logo (image upload → Vercel Blob)
- Primary color + accent color (color pickers with live preview)
- From email address and display name
- Default notification preferences for new users

### Members

- List of all org users, searchable
- Promote to org admin / demote
- View which groups each member belongs to

### Groups Overview

- All groups with member count, last event date, activity status
- Inactive group indicators
- Edit or delete any non-default group

## Project Structure

```
src/
  app/
    layout.tsx              # Root layout, theme injection, session provider
    page.tsx                # Redirect to feed or sign-in
    api/
      cron/
        notifications/      # Vercel Cron: reminders, recurring events, nudges
      access-request/
        approve/[token]/    # Signed URL for one-click approve
        deny/[token]/       # Signed URL for one-click deny
    (auth)/
      sign-in/              # Sign-in page with dynamic providers
      request-access/       # Access request submitted confirmation
    (app)/
      feed/                 # Home — event feed across all groups
      events/
        new/                # Create event form
        [id]/               # Event detail page
        [id]/edit/          # Edit event
      groups/
        page.tsx            # Browse/search groups
        new/                # Create group
        [id]/               # Group page (events, members)
        [id]/settings/      # Group settings (admins)
      settings/             # User profile, notification preferences
      admin/
        page.tsx            # Activity feed (landing)
        whitelist/          # Whitelist management
        access-requests/    # Pending/history
        settings/           # Org settings, branding
        members/            # Member management
        groups/             # Groups overview
  components/
    ui/                     # Button, Card, Input, Modal, Avatar, Toggle
    events/                 # EventCard, EventForm, RSVPButton, GuestPicker
    groups/                 # GroupCard, MemberList
    layout/                 # Header, Nav, ThemeToggle
    admin/                  # ActivityFeed, WhitelistTable, ColorPicker
  lib/
    auth.ts                 # Auth.js config, provider setup, whitelist check
    prisma.ts               # Prisma client singleton
    notifications/
      send-email.ts         # Resend integration
      templates/            # Email HTML templates
      triggers.ts           # Notification trigger logic
    utils.ts                # Shared utilities
  prisma/
    schema.prisma           # Full schema
    seed.ts                 # Seed default group, whitelist domain
```

## Environment Variables

```
# Required
DATABASE_URL              # Neon Postgres connection string
AUTH_SECRET               # Auth.js secret
ORG_NAME                  # Default org group name

# Auth providers (at least one required)
AUTH_GOOGLE_ID            # Google OAuth
AUTH_GOOGLE_SECRET
AUTH_GITHUB_ID            # GitHub OAuth
AUTH_GITHUB_SECRET
AUTH_APPLE_ID             # Apple OAuth
AUTH_APPLE_SECRET
AUTH_EMAIL_ENABLED        # Email Magic Link (requires RESEND_API_KEY)

# Optional
ORG_DOMAIN                # Seeds whitelist with domain (e.g. berkeley.edu)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY  # Enables location autocomplete
RESEND_API_KEY            # Email notifications + magic link auth
RESEND_FROM_EMAIL         # Default sender (e.g. events@cphsocial.com)
TWILIO_ACCOUNT_SID        # SMS (not used in v1)
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
```

## What's Deferred to Post-v1

- **SMS notifications**: schema supports it, no UI or Twilio integration in v1
- **Phone number collection**: field exists on User, no settings UI
- **Channel override UI**: NotificationPreference.channel field exists, not exposed
- **Advanced email features**: magic link auth (requires separate Resend config)
