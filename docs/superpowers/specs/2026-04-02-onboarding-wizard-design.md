# Onboarding Wizard — Design Spec

## Overview

First-run setup wizard for new uDown deployments. The first person to sign in becomes the org admin and is guided through configuring the site before anyone else can use it.

## Trigger

- First user signs in → no whitelist check (bootstrap mode) → becomes org admin
- `OrgSettings.onboardingComplete` is `false` (or no OrgSettings record exists)
- All authenticated routes redirect to `/onboarding` until onboarding is complete
- Non-admin users who sign in before onboarding is complete see a "Setting up..." holding page

## Steps

### Step 1: Org Settings (required)

- Org name (text input, required)
- Logo upload (optional, Vercel Blob)
- Primary color + accent color (color pickers, pre-filled with defaults #003262 / #16a0ac)
- On submit: creates or updates OrgSettings record AND renames the default group to match the org name

### Step 2: Add Members (skippable)

- Textarea for pasting emails (comma/newline separated)
- CSV upload button with preview of parsed emails before confirming
- Toggle: "Allow anyone from [domain] to join" with domain text input (adds a DOMAIN entry to whitelist)
- Each email added to the whitelist triggers an invite email to that address
- "Skip — add members later" button

### Step 3: Create Groups (skippable)

- Inline form: group name + description (both required)
- List of groups created so far with delete option
- "Skip — create groups later" button

### Step 4: Done

- Summary: org name, member count added, groups created
- "Go to your community" button
- Sets `onboardingComplete: true` on OrgSettings
- Redirects to `/feed`

## Invite Email

When an email is added to the whitelist during onboarding (or later via admin), the user receives an invite email:

- Subject: "You're invited to [OrgName]"
- Body: branded dark-themed email (reuses base template), CTA button "Join [OrgName]" linking to the sign-in page
- Uses the same Resend infrastructure as other notifications

## Schema Changes

- Add `onboardingComplete Boolean @default(false)` to OrgSettings model

## Removals

- Delete `prisma/seed.ts` — no longer needed (OrgSettings created during onboarding, default group created on first sign-in)
- Remove `prisma.seed` config from `prisma.config.ts`
- Remove `ORG_NAME` env var — org name set during onboarding
- Remove `ORG_DOMAIN` env var — domain wildcard is an explicit choice during onboarding, not a default
- Clean up references to `ORG_NAME` in `src/lib/org-settings.ts` and `src/lib/auth.ts` (use hardcoded fallbacks)
- Remove `ORG_NAME` and `ORG_DOMAIN` from `.env.example`

## Route Guard

- In the app layout (`src/app/(app)/layout.tsx`), check `onboardingComplete` from OrgSettings
- If false and user is org admin → redirect to `/onboarding`
- If false and user is NOT org admin → render a "Setting up..." page (not a redirect loop)
- The `/onboarding` route itself checks that the user is an org admin

## File Structure

```
src/app/(app)/onboarding/
  layout.tsx              # Onboarding layout (no header/nav, clean wizard UI)
  page.tsx                # Step router / wizard container
src/lib/actions/onboarding.ts   # Server actions for each step
src/lib/notifications/invite-email.ts  # Invite email template + send
```

## Auth Flow Change

In `src/lib/auth.ts` signIn callback:
- If no users exist (`prisma.user.count() === 0`), allow sign-in regardless of whitelist (bootstrap)
- This is already implemented in the pending uncommitted change
