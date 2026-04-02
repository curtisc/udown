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
            Description *
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            required
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
