import { prisma } from './prisma'

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

export async function generateUniqueEventSlug(name: string): Promise<string> {
  const base = generateSlug(name)
  const existing = await prisma.event.findUnique({ where: { slug: base } })
  if (!existing) return base

  let i = 2
  while (await prisma.event.findUnique({ where: { slug: `${base}-${i}` } })) {
    i++
  }
  return `${base}-${i}`
}

export async function generateUniqueGroupSlug(name: string): Promise<string> {
  const base = generateSlug(name)
  const existing = await prisma.group.findUnique({ where: { slug: base } })
  if (!existing) return base

  let i = 2
  while (await prisma.group.findUnique({ where: { slug: `${base}-${i}` } })) {
    i++
  }
  return `${base}-${i}`
}
