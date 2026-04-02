import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isOrgAdmin } from '@/lib/permissions'
import Link from 'next/link'

const tabs = [
  { href: '/admin', label: 'Activity' },
  { href: '/admin/whitelist', label: 'Whitelist' },
  { href: '/admin/access-requests', label: 'Requests' },
  { href: '/admin/settings', label: 'Settings' },
  { href: '/admin/members', label: 'Members' },
  { href: '/admin/groups', label: 'Groups' },
]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const admin = await isOrgAdmin(session.user.id)
  if (!admin) redirect('/feed')

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Admin</h2>
        <nav className="mt-3 flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  )
}
