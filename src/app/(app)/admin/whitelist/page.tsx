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
