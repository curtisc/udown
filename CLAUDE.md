# uDown

## Project Overview

uDown is an open source, web-based social event coordination platform. It allows anyone in a group to post events and anyone else to join them. The goal is to improve in-person social interactions and allow ad-hoc clubs/subgroups to form organically within a community.

Designed for small groups (10-100 people) like alumni networks, church groups, hobby communities, etc.

## Tech Stack (do not deviate)

- **Framework**: Next.js (App Router) with TypeScript
- **ORM**: Prisma
- **Database**: Neon (serverless Postgres)
- **Auth**: Auth.js (NextAuth v5) with configurable providers
- **Hosting**: Vercel
- **Styling**: Tailwind CSS
- **Location**: Google Places API (Autocomplete) for event location search
- **Email**: Resend (transactional email for notifications)
- **SMS**: Twilio (text message notifications)
- **File Storage**: Vercel Blob (for uploaded assets like org logo)

## Architecture Decisions

- Use Next.js App Router (not Pages Router)
- Use Server Components by default, Client Components only when needed
- Use Server Actions for mutations where appropriate
- All database access goes through Prisma — no raw SQL
- Auth.js with **configurable auth providers**. The app ships with built-in support for: Google OAuth, GitHub OAuth, Apple OAuth, and Email Magic Link (via Resend). Which providers are enabled is controlled via environment variables — if the credentials for a provider are present, it appears on the sign-in page; if not, it's hidden. This lets each deployment choose its own auth methods without code changes. For the cphsocial.com deployment, only Google is enabled. A church group might enable Email Magic Link instead. The sign-in page dynamically renders only the enabled providers.
- Auth.js with an **email whitelist** for access control. Only whitelisted email addresses can sign in and access the app, regardless of which auth provider they use. Org admins manage the whitelist in the admin settings page (bulk add, remove, import from CSV). The optional `ORG_DOMAIN` env var seeds an initial domain wildcard (e.g. `berkeley.edu`) but the whitelist is the authoritative access control.
- **Access requests**: If someone authenticates via any provider but their email is NOT on the whitelist, they see a friendly "request access" page instead of being rejected outright. Submitting the request notifies all org admins via email with the requester's name, email, and a **one-click approve button** (a signed URL that hits an API route to add the email to the whitelist and create their account). Admins can also deny or ignore the request.
- The default org group is auto-created on first run (seeded from `ORG_NAME` env var) and is marked as `isDefault: true` in the database. It cannot be deleted or left. All new users are automatically added to it on first sign-in.
- Keep the app simple and mobile-friendly — most users will access it from their phones
- Use Google Places Autocomplete for event location input. Use the `@react-google-maps/api` library's Autocomplete component. Store the place name, address, and lat/lng in the Event model so we don't need to re-fetch from Google on display. The Places API is enabled in the same Google Cloud project as the OAuth credentials.
- Notifications are sent inline on event-triggered actions (new event, RSVP, event update) via server actions or API routes. Event reminders (24hr before) are dispatched via Vercel Cron Jobs hitting an API route that queries upcoming events and sends batched notifications. At this scale, direct sends to Resend/Twilio are fine — no queue needed.
- Email sending pattern: The `From` address uses the verified deployment domain (e.g. `events@cphsocial.com`). The from address and display name are configurable by org admins in the admin settings page (stored in the database, falling back to the `RESEND_FROM_EMAIL` env var as default). This requires DNS records (DKIM, SPF) on the domain but no actual mailbox. The `Reply-To` is dynamically set to the email of the group owner/admin who created the group the notification is about. This way replies go to a real person, not a dead inbox. For notifications that span multiple groups or are system-level (e.g. welcome email), reply-to falls back to the org-level admin.

## Core Concepts

- **Users**: Authenticated via any enabled auth provider. Have a name, email, avatar (from OAuth profile or generated for magic link users). Can only sign in if their email is on the org whitelist.
- **EmailWhitelist**: A list of approved email addresses managed by org admins. Can be individual emails or entire domains (e.g. `@berkeley.edu`). Managed in the admin settings page with support for bulk add and CSV import.
- **AccessRequest**: When a non-whitelisted user tries to sign in, an access request record is created with their name, email, avatar, and timestamp. Status: "pending", "approved", or "denied". Approval adds the email to the whitelist and creates the user account.
- **Groups**: A community of users. Every deployment has a single **default group** named after the organization (e.g. "Berkeley/UCSF CPH Program", "St. Mark's Community") that all users automatically belong to and that cannot be deleted or left. Beyond the default group, any user can create additional groups (e.g. "Hikers", "Board Game Night Crew", "Parents") to form ad-hoc subgroups within the community. Each group has an **owner** (the creator) and can have additional admins. The owner's email is used as the reply-to address on notification emails for that group. Groups track a `lastEventAt` timestamp and have a configurable `inactivityThresholdDays` setting (default: 30) that controls when admin nudge notifications fire.
- **Events**: Posted by any group member. Have a title, description, date/time, location (structured via Google Places: place name, address, lat/lng, and Google Place ID), and optional capacity. Any group member can join.
- **RSVPs**: Users respond to events. Statuses: "down" (attending), "maybe", or no response.
- **Tags/Categories**: Events can be tagged (e.g. "outdoors", "food", "sports", "games") to allow filtering and to let ad-hoc interest-based subgroups emerge organically.
- **Notifications**: Users are notified about activity in their groups. Notifications are sent via email (Resend) and/or SMS (Twilio) based on user preferences.
- **OrgSettings**: A singleton database record for org-wide configuration. Stores: org name, org logo (uploaded image stored locally or via a service like Vercel Blob), notification from email and display name, and default notification preferences for new users. The logo is displayed in the app header, sign-in page, and notification emails. Editable by org admins (admins of the default group) via the admin settings page. Values fall back to environment variables if not set in the database.

### Notification Preferences Model

Users control notifications at two levels:

1. **Global preferences** (user-level settings):
   - Email notifications: on/off (email comes from auth profile, always available)
   - SMS notifications: on/off (requires user to add phone number in settings)
   - Phone number: stored on user profile, required for SMS

2. **Per-group preferences** (override global for each group):
   - Notify on new events: on/off
   - Notify on event updates/changes: on/off
   - Notify on RSVP milestones (e.g. "5 people are down!"): on/off
   - Event reminders (e.g. 24hr before): on/off
   - Channel override: email only / SMS only / both / off entirely

A notification is only sent if: (a) the global channel is enabled, AND (b) the per-group preference for that notification type is enabled. Per-group "off" always wins.

### Notification Triggers

- **New event posted** in a group the user belongs to
- **Event updated** (time, location, or description changed) for events the user has RSVP'd to
- **Event reminder** sent ~24 hours before an event the user is "down" for
- **RSVP milestone** (optional, e.g. "10 people are down for Game Night on Saturday!")
- **Group inactivity nudge** (admin-only): If no events have been posted in a group for a configurable period (default: 30 days), group admins receive a nudge notification. The inactivity threshold is configurable per group in group settings. The group tracks a `lastNudgeSentAt` timestamp so the cron only sends one nudge per inactivity period (not daily). A new event resets the clock. This prevents zombie groups from going stale without anyone noticing. Checked by the same Vercel Cron Job that handles event reminders.
- **Access request** (admin-only): When a non-whitelisted user requests access, all org admins are notified via email with the requester's details and one-click approve/deny links (signed URLs).

## Key Flows

1. **Onboarding (whitelisted)**: User signs in via any enabled provider → email is on whitelist → account created → automatically added to the default org group → lands on the main event feed. Can optionally join additional subgroups.
2. **Onboarding (not whitelisted)**: User signs in → email is NOT on whitelist → shown a friendly "request access" page → user submits request → org admins notified via email with one-click approve/deny buttons → on approval, user is added to whitelist, account created, and user notified they can now sign in.
3. **Browsing**: User sees upcoming events in their groups, can filter by tag/category
4. **Posting an event**: Any group member can create an event with title, description, datetime, location, tags, optional capacity
5. **Joining an event**: User taps "I'm Down" to RSVP. Can see who else is down.
6. **Group management**: Any user can create a new subgroup. Group creators are admins. Admins can invite users (via shareable link), remove members, and edit group details. The default org group cannot be deleted and has no leave option.
7. **Notification settings**: User accesses settings → enables/disables email and SMS globally → optionally adds phone number for SMS → can fine-tune per-group notification preferences (new events, updates, reminders, milestones) and choose channel (email, SMS, both).
8. **Org admin settings**: Org admins (admins of the default group) can configure org-wide settings including: email whitelist management (add/remove individuals, add domain wildcards, bulk CSV import), pending access requests (approve/deny), from email address and display name for notifications, org name/logo, and default notification preferences for new users.

## UI/UX Principles

- Mobile-first design
- The primary UI metaphor is a feed of upcoming events
- RSVP action should be a single tap ("I'm Down" button)
- Show attendee avatars on event cards for social proof
- Keep it lightweight and fast — no unnecessary complexity
- Fun, casual tone throughout (not corporate)

## Project Structure

```
src/
  app/              # Next.js App Router pages and layouts
    api/            # API routes (if needed beyond server actions)
    (auth)/         # Auth-related pages (sign-in, etc.)
    (app)/          # Authenticated app pages
      groups/
      events/
      settings/     # User profile, notification preferences
      admin/        # Org admin settings (email config, org name, domain restriction)
  components/       # Shared React components
    ui/             # Base UI components
  lib/              # Utilities, auth config, prisma client
    notifications/  # Email (Resend) and SMS (Twilio) sending logic
  prisma/           # Prisma schema and migrations
```

## Commands

- `npm run dev` — local dev server
- `npx prisma generate` — regenerate Prisma client after schema changes
- `npx prisma migrate dev` — run database migrations
- `npx prisma studio` — browse database in browser

## Environment Variables

```
DATABASE_URL=           # Neon Postgres connection string
AUTH_SECRET=            # Auth.js secret (generate with `openssl rand -base64 32`)

# Auth providers — each provider is enabled by setting its credentials.
# If credentials are absent, the provider is hidden from the sign-in page.
AUTH_GOOGLE_ID=         # Google OAuth client ID (optional)
AUTH_GOOGLE_SECRET=     # Google OAuth client secret (optional)
AUTH_GITHUB_ID=         # GitHub OAuth client ID (optional)
AUTH_GITHUB_SECRET=     # GitHub OAuth client secret (optional)
AUTH_APPLE_ID=          # Apple OAuth client ID (optional)
AUTH_APPLE_SECRET=      # Apple OAuth client secret (optional)
AUTH_EMAIL_ENABLED=     # Set to "true" to enable Email Magic Link sign-in via Resend (optional)

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=  # Google Maps/Places API key (same GCP project as OAuth)
ORG_NAME=                # Organization name used for the default group (e.g. "Berkeley/UCSF CPH Program")
ORG_DOMAIN=              # Optional: seeds the whitelist with a domain wildcard on first run (e.g. "berkeley.edu" allows all @berkeley.edu emails)
RESEND_API_KEY=          # Resend API key for transactional email notifications AND magic link emails
RESEND_FROM_EMAIL=       # Default sender address, overridable in org admin settings (e.g. "events@cphsocial.com")
TWILIO_ACCOUNT_SID=      # Twilio account SID for SMS notifications
TWILIO_AUTH_TOKEN=        # Twilio auth token
TWILIO_PHONE_NUMBER=     # Twilio phone number to send SMS from
```
