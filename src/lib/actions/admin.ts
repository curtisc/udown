'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { isOrgAdmin } from '@/lib/permissions'
import { logActivity } from '@/lib/activity-log'
import { put } from '@vercel/blob'

async function requireOrgAdmin() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  const admin = await isOrgAdmin(session.user.id)
  if (!admin) throw new Error('Not an org admin')
  return session
}

// ---- Whitelist ----

export async function addWhitelistEntry(formData: FormData) {
  const session = await requireOrgAdmin()
  const emails = (formData.get('emails') as string)?.trim()
  if (!emails) throw new Error('No emails provided')

  const entries = emails.split(/[,\n]/).map((e) => e.trim()).filter(Boolean)

  for (const entry of entries) {
    const isDomain = !entry.includes('@')
    const email = isDomain ? entry.replace(/^@/, '') : entry.toLowerCase()
    const type = isDomain ? 'DOMAIN' : 'EMAIL'

    await prisma.emailWhitelist.upsert({
      where: { email_type: { email, type } },
      create: { email, type, addedById: session.user.id },
      update: {},
    })
  }

  logActivity({
    actorId: session.user.id,
    action: 'SETTINGS_UPDATED',
    targetType: 'SETTINGS',
    targetId: 'whitelist',
    metadata: { added: entries },
  })

  revalidatePath('/admin/whitelist')
}

export async function removeWhitelistEntry(entryId: string) {
  const session = await requireOrgAdmin()

  const entry = await prisma.emailWhitelist.findUnique({ where: { id: entryId } })
  if (!entry) throw new Error('Entry not found')

  await prisma.emailWhitelist.delete({ where: { id: entryId } })

  logActivity({
    actorId: session.user.id,
    action: 'SETTINGS_UPDATED',
    targetType: 'SETTINGS',
    targetId: 'whitelist',
    metadata: { removed: entry.email },
  })

  revalidatePath('/admin/whitelist')
}

// ---- Org Settings ----

export async function updateOrgSettings(formData: FormData) {
  const session = await requireOrgAdmin()

  const orgName = (formData.get('orgName') as string)?.trim()
  if (!orgName) throw new Error('Org name is required')

  const data: Record<string, unknown> = {
    orgName,
    primaryColor: (formData.get('primaryColor') as string) || '#003262',
    accentColor: (formData.get('accentColor') as string) || '#16a0ac',
    fromEmail: (formData.get('fromEmail') as string)?.trim() || null,
    fromName: (formData.get('fromName') as string)?.trim() || null,
  }

  // Handle logo upload
  const logo = formData.get('logo') as File | null
  if (logo && logo.size > 0) {
    try {
      const blob = await put(`org-logo-${Date.now()}.${logo.name.split('.').pop()}`, logo, {
        access: 'public',
      })
      data.orgLogo = blob.url
    } catch (error) {
      console.error('Logo upload failed:', error)
    }
  }

  const existing = await prisma.orgSettings.findFirst()
  if (existing) {
    await prisma.orgSettings.update({
      where: { id: existing.id },
      data,
    })
  } else {
    await prisma.orgSettings.create({ data: data as Parameters<typeof prisma.orgSettings.create>[0]['data'] })
  }

  logActivity({
    actorId: session.user.id,
    action: 'SETTINGS_UPDATED',
    targetType: 'SETTINGS',
    targetId: 'org',
    metadata: { orgName },
  })

  revalidatePath('/admin/settings')
  revalidatePath('/', 'layout')
}

// ---- Members ----

export async function promoteToOrgAdmin(userId: string) {
  const session = await requireOrgAdmin()

  const defaultGroup = await prisma.group.findFirst({ where: { isDefault: true } })
  if (!defaultGroup) throw new Error('No default group')

  await prisma.groupMember.update({
    where: { userId_groupId: { userId, groupId: defaultGroup.id } },
    data: { role: 'ADMIN' },
  })

  logActivity({
    actorId: session.user.id,
    action: 'SETTINGS_UPDATED',
    targetType: 'USER',
    targetId: userId,
    metadata: { action: 'promoted to org admin' },
  })

  revalidatePath('/admin/members')
}

export async function demoteFromOrgAdmin(userId: string) {
  const session = await requireOrgAdmin()

  const defaultGroup = await prisma.group.findFirst({ where: { isDefault: true } })
  if (!defaultGroup) throw new Error('No default group')
  if (defaultGroup.ownerId === userId) throw new Error('Cannot demote the org owner')

  await prisma.groupMember.update({
    where: { userId_groupId: { userId, groupId: defaultGroup.id } },
    data: { role: 'MEMBER' },
  })

  logActivity({
    actorId: session.user.id,
    action: 'SETTINGS_UPDATED',
    targetType: 'USER',
    targetId: userId,
    metadata: { action: 'demoted from org admin' },
  })

  revalidatePath('/admin/members')
}
