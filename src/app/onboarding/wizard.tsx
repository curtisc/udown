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
