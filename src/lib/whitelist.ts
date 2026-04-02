export type WhitelistEntry = {
  email: string
  type: 'EMAIL' | 'DOMAIN'
}

export function checkEmailAgainstWhitelist(
  email: string,
  entries: WhitelistEntry[]
): boolean {
  const normalizedEmail = email.toLowerCase()
  const domain = normalizedEmail.split('@')[1]

  return entries.some((entry) => {
    if (entry.type === 'EMAIL') {
      return entry.email.toLowerCase() === normalizedEmail
    }
    if (entry.type === 'DOMAIN') {
      return domain === entry.email.toLowerCase()
    }
    return false
  })
}

export async function isWhitelisted(email: string): Promise<boolean> {
  const { prisma } = await import('./prisma')
  const entries = await prisma.emailWhitelist.findMany({
    select: { email: true, type: true },
  })
  return checkEmailAgainstWhitelist(email, entries)
}
