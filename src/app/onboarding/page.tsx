import { prisma } from '@/lib/prisma'
import { getOrgSettings } from '@/lib/org-settings'
import { OnboardingWizard } from './wizard'

export default async function OnboardingPage() {
  const org = await getOrgSettings()
  const settings = await prisma.orgSettings.findFirst()

  const whitelist = await prisma.emailWhitelist.findMany({
    orderBy: { createdAt: 'desc' },
  })

  const groups = await prisma.group.findMany({
    where: { isDefault: false },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <OnboardingWizard
      orgSettings={{
        orgName: settings?.orgName || '',
        orgLogo: settings?.orgLogo || null,
        primaryColor: settings?.primaryColor || '#003262',
        accentColor: settings?.accentColor || '#16a0ac',
        hasSettings: !!settings,
      }}
      whitelistCount={whitelist.length}
      groups={groups.map((g) => ({ id: g.id, name: g.name, description: g.description }))}
    />
  )
}
