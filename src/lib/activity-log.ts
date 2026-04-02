import { prisma } from '@/lib/prisma'
import type { ActivityAction, ActivityTarget } from '@prisma/client'
import type { Prisma } from '@prisma/client'

export function logActivity(params: {
  actorId: string
  action: ActivityAction
  targetType: ActivityTarget
  targetId: string
  metadata: Record<string, unknown>
}): void {
  void prisma.activityLog
    .create({
      data: {
        actorId: params.actorId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        metadata: params.metadata as Prisma.InputJsonValue,
      },
    })
    .catch(console.error)
}
