import { prisma } from './prisma'

export type OrgSettingsData = {
  orgName: string
  orgLogo: string | null
  primaryColor: string
  accentColor: string
  fromEmail: string | null
  fromName: string | null
}

export async function getOrgSettings(): Promise<OrgSettingsData> {
  const defaults: OrgSettingsData = {
    orgName: process.env.ORG_NAME || 'uDown',
    orgLogo: null,
    primaryColor: '#003262',
    accentColor: '#16a0ac',
    fromEmail: process.env.RESEND_FROM_EMAIL || null,
    fromName: null,
  }

  try {
    const settings = await prisma.orgSettings.findFirst()
    if (!settings) return defaults

    return {
      orgName: settings.orgName || defaults.orgName,
      orgLogo: settings.orgLogo,
      primaryColor: settings.primaryColor || defaults.primaryColor,
      accentColor: settings.accentColor || defaults.accentColor,
      fromEmail: settings.fromEmail || defaults.fromEmail,
      fromName: settings.fromName,
    }
  } catch {
    // Database not yet migrated — return defaults
    return defaults
  }
}
