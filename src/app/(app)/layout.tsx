import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { getOrgSettings } from '@/lib/org-settings'
import { isOrgAdmin } from '@/lib/permissions'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  const org = await getOrgSettings()
  const admin = await isOrgAdmin(session.user.id)

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Header
        userName={session.user.name}
        userImage={session.user.image}
        orgName={org.orgName}
        isAdmin={admin}
      />
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
    </div>
  )
}
