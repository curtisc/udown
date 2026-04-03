import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { updateGroup, deleteGroup } from '@/lib/actions/groups'
import { isGroupAdmin } from '@/lib/permissions'
import { SubmitButton } from '@/components/ui/submit-button'

type Props = {
  params: Promise<{ slug: string }>
}

export default async function GroupSettingsPage({ params }: Props) {
  const { slug } = await params
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const group = await prisma.group.findUnique({ where: { slug } })
  if (!group) notFound()
  if (group.isDefault) redirect(`/groups/${slug}`)

  const adminStatus = await isGroupAdmin(session.user.id, group.id)
  if (!adminStatus) redirect(`/groups/${slug}`)

  const boundUpdateGroup = updateGroup.bind(null, group.id)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Group Settings</h2>
        <Link
          href={`/groups/${slug}`}
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
            Description *
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            required
            defaultValue={group.description || ''}
            className="mt-1 w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-primary)] px-3 py-2 text-[var(--text-primary)] focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]"
          />
        </div>
        <SubmitButton
          className="rounded-lg bg-[var(--brand-accent)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          pendingText="Saving..."
        >
          Save Changes
        </SubmitButton>
      </form>

      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
        <h3 className="mb-2 text-sm font-medium text-red-400">Danger Zone</h3>
        <p className="mb-3 text-sm text-[var(--text-secondary)]">
          Deleting this group will remove all its events and member data. This cannot be undone.
        </p>
        <form
          action={async () => {
            'use server'
            await deleteGroup(group.id)
          }}
        >
          <SubmitButton
            className="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30"
            pendingText="Deleting..."
          >
            Delete Group
          </SubmitButton>
        </form>
      </div>
    </div>
  )
}
