'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isOrgAdmin } from '@/lib/permissions'
import { put } from '@vercel/blob'
import { sendInviteEmail } from '@/lib/notifications/invite-email'

async function requireOnboardingAdmin() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  const admin = await isOrgAdmin(session.user.id)
  if (!admin) throw new Error('Not an org admin')
  return session
}

export async function saveOrgSettings(formData: FormData) {
  const session = await requireOnboardingAdmin()

  const orgName = (formData.get('orgName') as string)?.trim()
  if (!orgName) throw new Error('Org name is required')

  const data: Record<string, unknown> = {
    orgName,
    primaryColor: (formData.get('primaryColor') as string) || '#003262',
    accentColor: (formData.get('accentColor') as string) || '#16a0ac',
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

  // Upsert OrgSettings
  const existing = await prisma.orgSettings.findFirst()
  if (existing) {
    await prisma.orgSettings.update({ where: { id: existing.id }, data })
  } else {
    await prisma.orgSettings.create({ data: data as Parameters<typeof prisma.orgSettings.create>[0]['data'] })
  }

  // Rename the default group to match org name
  const defaultGroup = await prisma.group.findFirst({ where: { isDefault: true } })
  if (defaultGroup) {
    await prisma.group.update({
      where: { id: defaultGroup.id },
      data: { name: orgName },
    })
  }

  revalidatePath('/onboarding')
  revalidatePath('/', 'layout')
}

export async function addOnboardingMembers(formData: FormData) {
  const session = await requireOnboardingAdmin()

  const emailsStr = (formData.get('emails') as string)?.trim()
  const domainEnabled = formData.get('domainEnabled') === 'true'
  const domain = (formData.get('domain') as string)?.trim()

  const addedEmails: string[] = []

  // Parse individual emails
  if (emailsStr) {
    const emails = emailsStr.split(/[,\n]/).map((e) => e.trim().toLowerCase()).filter(Boolean)
    for (const email of emails) {
      if (!email.includes('@')) continue
      await prisma.emailWhitelist.upsert({
        where: { email_type: { email, type: 'EMAIL' } },
        create: { email, type: 'EMAIL', addedById: session.user.id },
        update: {},
      })
      addedEmails.push(email)
    }
  }

  // Handle CSV upload
  const csv = formData.get('csv') as File | null
  if (csv && csv.size > 0) {
    const text = await csv.text()
    const csvEmails = text
      .split(/[,\n\r]+/)
      .map((e) => e.trim().toLowerCase().replace(/^["']|["']$/g, ''))
      .filter((e) => e.includes('@'))

    for (const email of csvEmails) {
      await prisma.emailWhitelist.upsert({
        where: { email_type: { email, type: 'EMAIL' } },
        create: { email, type: 'EMAIL', addedById: session.user.id },
        update: {},
      })
      addedEmails.push(email)
    }
  }

  // Handle domain wildcard
  if (domainEnabled && domain) {
    const cleanDomain = domain.replace(/^@/, '').toLowerCase()
    await prisma.emailWhitelist.upsert({
      where: { email_type: { email: cleanDomain, type: 'DOMAIN' } },
      create: { email: cleanDomain, type: 'DOMAIN', addedById: session.user.id },
      update: {},
    })
  }

  // Send invite emails (fire-and-forget)
  const uniqueEmails = [...new Set(addedEmails)]
  for (const email of uniqueEmails) {
    void sendInviteEmail(email).catch(console.error)
  }

  revalidatePath('/onboarding')
}

export async function createOnboardingGroup(formData: FormData) {
  const session = await requireOnboardingAdmin()

  const name = (formData.get('name') as string)?.trim()
  if (!name) throw new Error('Group name is required')

  const description = (formData.get('description') as string)?.trim()
  if (!description) throw new Error('Group description is required')

  const group = await prisma.group.create({
    data: {
      name,
      description,
      ownerId: session.user.id,
    },
  })

  await prisma.groupMember.create({
    data: {
      userId: session.user.id,
      groupId: group.id,
      role: 'ADMIN',
    },
  })

  revalidatePath('/onboarding')
}

export async function deleteOnboardingGroup(groupId: string) {
  await requireOnboardingAdmin()

  const group = await prisma.group.findUnique({ where: { id: groupId } })
  if (!group || group.isDefault) throw new Error('Cannot delete this group')

  await prisma.group.delete({ where: { id: groupId } })
  revalidatePath('/onboarding')
}

export async function completeOnboarding() {
  await requireOnboardingAdmin()

  const existing = await prisma.orgSettings.findFirst()
  if (!existing) throw new Error('Org settings not configured')

  await prisma.orgSettings.update({
    where: { id: existing.id },
    data: { onboardingComplete: true },
  })

  revalidatePath('/', 'layout')
  redirect('/feed')
}
