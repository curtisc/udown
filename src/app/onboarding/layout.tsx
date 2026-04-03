import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isOrgAdmin } from '@/lib/permissions'
import { getOrgSettings } from '@/lib/org-settings'

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect('/sign-in')

  // If onboarding is already complete, go to feed
  const org = await getOrgSettings()
  const settings = await (await import('@/lib/prisma')).prisma.orgSettings.findFirst()
  if (settings?.onboardingComplete) redirect('/feed')

  const admin = await isOrgAdmin(session.user.id)
  if (!admin) {
    // Non-admin during onboarding — show holding page
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center px-4">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Setting up...</h1>
          <p className="mt-2 text-[var(--text-secondary)]">
            The admin is setting up this community. Check back soon!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="mx-auto max-w-xl px-4 py-12">
        {children}
      </div>
    </div>
  )
}
