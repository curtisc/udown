'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { isGroupAdmin } from '@/lib/permissions'
import { logActivity } from '@/lib/activity-log'
import { generateUniqueGroupSlug } from '@/lib/slugify'

export async function createGroup(formData: FormData) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const name = formData.get('name') as string
  if (!name?.trim()) throw new Error('Name is required')

  const slug = await generateUniqueGroupSlug(name.trim())

  const group = await prisma.group.create({
    data: {
      name: name.trim(),
      slug,
      description: (formData.get('description') as string)?.trim() || null,
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

  logActivity({ actorId: session.user.id, action: 'GROUP_CREATED', targetType: 'GROUP', targetId: group.id, metadata: { groupName: group.name } })

  revalidatePath('/groups')
  redirect(`/groups/${group.slug}`)
}

export async function updateGroup(groupId: string, formData: FormData) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const group = await prisma.group.findUnique({ where: { id: groupId } })
  if (!group) throw new Error('Group not found')
  if (group.isDefault) throw new Error('Cannot edit the default group')

  const canEdit = await isGroupAdmin(session.user.id, groupId)
  if (!canEdit) throw new Error('Not authorized')

  const name = formData.get('name') as string
  if (!name?.trim()) throw new Error('Name is required')

  const updatedGroup = await prisma.group.update({
    where: { id: groupId },
    data: {
      name: name.trim(),
      description: (formData.get('description') as string)?.trim() || null,
    },
  })

  revalidatePath('/groups', 'layout')
  redirect(`/groups/${updatedGroup.slug}/settings`)
}

export async function deleteGroup(groupId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const group = await prisma.group.findUnique({ where: { id: groupId } })
  if (!group) throw new Error('Group not found')
  if (group.isDefault) throw new Error('Cannot delete the default group')

  const canEdit = await isGroupAdmin(session.user.id, groupId)
  if (!canEdit) throw new Error('Not authorized')

  await prisma.group.delete({ where: { id: groupId } })

  revalidatePath('/groups')
  redirect('/groups')
}

export async function joinGroup(groupId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const existing = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  })
  if (existing) return // already a member

  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { name: true } })

  await prisma.groupMember.create({
    data: {
      userId: session.user.id,
      groupId,
      role: 'MEMBER',
    },
  })

  logActivity({ actorId: session.user.id, action: 'GROUP_JOINED', targetType: 'GROUP', targetId: groupId, metadata: { groupName: group?.name } })

  revalidatePath('/groups', 'layout')
  revalidatePath('/feed')
}

export async function leaveGroup(groupId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const group = await prisma.group.findUnique({ where: { id: groupId } })
  if (!group) throw new Error('Group not found')
  if (group.isDefault) throw new Error('Cannot leave the default group')
  if (group.ownerId === session.user.id) throw new Error('Owner cannot leave. Transfer ownership first.')

  await prisma.groupMember.deleteMany({
    where: { userId: session.user.id, groupId },
  })

  logActivity({ actorId: session.user.id, action: 'GROUP_LEFT', targetType: 'GROUP', targetId: groupId, metadata: { groupName: group.name } })

  // Also remove notification prefs for this group
  await prisma.notificationPreference.deleteMany({
    where: { userId: session.user.id, groupId },
  })

  revalidatePath('/groups', 'layout')
  revalidatePath('/feed')
  redirect('/groups')
}

export async function removeMember(groupId: string, targetUserId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const canEdit = await isGroupAdmin(session.user.id, groupId)
  if (!canEdit) throw new Error('Not authorized')

  const [group, targetUser] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId }, select: { name: true, ownerId: true } }),
    prisma.user.findUnique({ where: { id: targetUserId }, select: { name: true } }),
  ])
  if (group?.ownerId === targetUserId) throw new Error('Cannot remove the group owner')

  await prisma.groupMember.deleteMany({
    where: { userId: targetUserId, groupId },
  })

  logActivity({ actorId: session.user.id, action: 'MEMBER_REMOVED', targetType: 'GROUP', targetId: groupId, metadata: { groupName: group?.name, removedUserName: targetUser?.name } })

  await prisma.notificationPreference.deleteMany({
    where: { userId: targetUserId, groupId },
  })

  revalidatePath('/groups', 'layout')
}

export async function promoteMember(groupId: string, targetUserId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const canEdit = await isGroupAdmin(session.user.id, groupId)
  if (!canEdit) throw new Error('Not authorized')

  await prisma.groupMember.update({
    where: { userId_groupId: { userId: targetUserId, groupId } },
    data: { role: 'ADMIN' },
  })

  revalidatePath('/groups', 'layout')
}

export async function demoteMember(groupId: string, targetUserId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const group = await prisma.group.findUnique({ where: { id: groupId } })
  if (group?.ownerId === targetUserId) throw new Error('Cannot demote the group owner')

  const canEdit = await isGroupAdmin(session.user.id, groupId)
  if (!canEdit) throw new Error('Not authorized')

  await prisma.groupMember.update({
    where: { userId_groupId: { userId: targetUserId, groupId } },
    data: { role: 'MEMBER' },
  })

  revalidatePath('/groups', 'layout')
}

export async function transferOwnership(groupId: string, newOwnerId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const group = await prisma.group.findUnique({ where: { id: groupId } })
  if (!group) throw new Error('Group not found')
  if (group.ownerId !== session.user.id) throw new Error('Only the owner can transfer ownership')

  // New owner must be an admin
  const newOwnerMembership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: newOwnerId, groupId } },
  })
  if (newOwnerMembership?.role !== 'ADMIN') throw new Error('New owner must be an admin')

  await prisma.group.update({
    where: { id: groupId },
    data: { ownerId: newOwnerId },
  })

  revalidatePath('/groups', 'layout')
}
