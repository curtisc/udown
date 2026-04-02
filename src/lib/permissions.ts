type GroupMemberRole = 'MEMBER' | 'ADMIN'

export function checkGroupAdmin(params: {
  memberRole: GroupMemberRole | null
  orgAdminRole: GroupMemberRole | null
}): boolean {
  return params.memberRole === 'ADMIN' || params.orgAdminRole === 'ADMIN'
}

export function checkCanEditGroup(params: {
  isDefault: boolean
  isAdmin: boolean
}): boolean {
  if (params.isDefault) return false
  return params.isAdmin
}

export async function isGroupAdmin(userId: string, groupId: string): Promise<boolean> {
  const { prisma } = await import('@/lib/prisma')

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  })

  const defaultGroup = await prisma.group.findFirst({
    where: { isDefault: true },
  })

  let orgAdminRole: GroupMemberRole | null = null
  if (defaultGroup) {
    const orgMembership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId: defaultGroup.id } },
    })
    orgAdminRole = orgMembership?.role ?? null
  }

  return checkGroupAdmin({
    memberRole: membership?.role ?? null,
    orgAdminRole,
  })
}

export async function isOrgAdmin(userId: string): Promise<boolean> {
  const { prisma } = await import('@/lib/prisma')

  const defaultGroup = await prisma.group.findFirst({
    where: { isDefault: true },
  })
  if (!defaultGroup) return false

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId: defaultGroup.id } },
  })

  return membership?.role === 'ADMIN'
}
