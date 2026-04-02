'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function getTags() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  return prisma.tag.findMany({ orderBy: { name: 'asc' } })
}

export async function createTag(name: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return prisma.tag.upsert({
    where: { slug },
    create: { name: name.trim(), slug },
    update: {},
  })
}

export async function setEventTags(eventId: string, tagIds: string[]) {
  // Remove existing tags
  await prisma.eventTag.deleteMany({ where: { eventId } })

  // Add new tags
  for (const tagId of tagIds) {
    await prisma.eventTag.create({
      data: { eventId, tagId },
    }).catch(() => {}) // Ignore invalid tagIds
  }
}
