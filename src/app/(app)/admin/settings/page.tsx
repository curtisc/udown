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
          <label
            htmlFor="logo"
            className="mt-1 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-primary)]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            Upload logo
          </label>
          <input
            id="logo"
            name="logo"
            type="file"
            accept="image/*"
            className="hidden"
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
