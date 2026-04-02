import { prisma } from '@/lib/prisma'

const rsvpLabels: Record<string, string> = {
  DOWN: 'down',
  MAYBE: 'maybe',
  NOT_DOWN: 'not down',
}

function formatAction(action: string, meta: Record<string, string>): string {
  switch (action) {
    case 'EVENT_CREATED':
      return `created event "${meta.eventTitle || ''}"`
    case 'EVENT_UPDATED':
      return `updated event "${meta.eventTitle || ''}"`
    case 'EVENT_DELETED':
      return `deleted event "${meta.eventTitle || ''}"`
    case 'RSVP_CREATED':
      return `RSVP'd ${rsvpLabels[meta.status] || meta.status} for "${meta.eventTitle || ''}"`
    case 'RSVP_UPDATED':
      return `changed RSVP from ${rsvpLabels[meta.previousStatus] || meta.previousStatus} to ${rsvpLabels[meta.status] || meta.status} for "${meta.eventTitle || ''}"`
    case 'GROUP_CREATED':
      return `created group "${meta.groupName || ''}"`
    case 'GROUP_JOINED':
      return `joined group "${meta.groupName || 'unknown'}"`
    case 'GROUP_LEFT':
      return `left group "${meta.groupName || 'unknown'}"`
    case 'MEMBER_REMOVED':
      return `removed ${meta.removedUserName || 'a member'} from "${meta.groupName || 'a group'}"`
    case 'ACCESS_REQUESTED':
      return 'requested access'
    case 'ACCESS_APPROVED':
      return `approved access for ${meta.email || 'a user'}`
    case 'ACCESS_DENIED':
      return `denied access for ${meta.email || 'a user'}`
    case 'SETTINGS_UPDATED':
      return meta.orgName ? `updated org settings (${meta.orgName})` : 'updated settings'
    case 'USER_JOINED':
      return 'joined the org'
    default:
      return action
  }
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default async function AdminActivityPage() {
  const logs = await prisma.activityLog.findMany({
    include: { actor: { select: { name: true, image: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return (
    <div className="space-y-2">
      {logs.length > 0 ? (
        logs.map((log) => {
          const meta = log.metadata as Record<string, string>

          return (
            <div key={log.id} className="flex items-start gap-3 rounded-lg bg-[var(--bg-card)] px-4 py-3">
              {log.actor.image ? (
                <img src={log.actor.image} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-surface)] text-xs font-bold text-[var(--text-secondary)]">
                  {(log.actor.name || '?')[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm text-[var(--text-primary)]">
                  <strong>{log.actor.name || 'Someone'}</strong>{' '}
                  {formatAction(log.action, meta)}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">{timeAgo(log.createdAt)}</p>
              </div>
            </div>
          )
        })
      ) : (
        <p className="py-8 text-center text-sm text-[var(--text-secondary)]">No activity yet.</p>
      )}
    </div>
  )
}
