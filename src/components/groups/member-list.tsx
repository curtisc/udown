'use client'

import { useTransition } from 'react'
import { promoteMember, demoteMember, removeMember } from '@/lib/actions/groups'

type Member = {
  userId: string
  role: 'MEMBER' | 'ADMIN'
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

type MemberListProps = {
  groupId: string
  ownerId: string
  members: Member[]
  currentUserId: string
  isAdmin: boolean
  isDefault: boolean
}

export function MemberList({
  groupId,
  ownerId,
  members,
  currentUserId,
  isAdmin,
  isDefault,
}: MemberListProps) {
  const [isPending, startTransition] = useTransition()

  const sorted = [...members].sort((a, b) => {
    if (a.userId === ownerId) return -1
    if (b.userId === ownerId) return 1
    if (a.role === 'ADMIN' && b.role !== 'ADMIN') return -1
    if (a.role !== 'ADMIN' && b.role === 'ADMIN') return 1
    return 0
  })

  return (
    <div className="space-y-2">
      {sorted.map((m) => {
        const isOwner = m.userId === ownerId
        const isSelf = m.userId === currentUserId
        const canManage = isAdmin && !isSelf && !isOwner

        return (
          <div
            key={m.userId}
            className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-[var(--bg-surface)]"
          >
            <div className="flex items-center gap-2">
              {m.user.image ? (
                <img
                  src={m.user.image}
                  alt={m.user.name || ''}
                  className="h-8 w-8 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-surface)] text-sm font-bold text-[var(--text-secondary)]">
                  {(m.user.name || '?')[0].toUpperCase()}
                </div>
              )}
              <div>
                <span className="text-sm text-[var(--text-primary)]">
                  {m.user.name || m.user.email}
                </span>
                {isSelf && (
                  <span className="ml-1 text-xs text-[var(--text-secondary)]">(you)</span>
                )}
              </div>
              {isOwner && (
                <span className="rounded-full bg-[var(--brand-accent)]/20 px-2 py-0.5 text-xs font-medium text-[var(--brand-accent)]">
                  Owner
                </span>
              )}
              {!isOwner && m.role === 'ADMIN' && (
                <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-400">
                  Admin
                </span>
              )}
            </div>

            {canManage && (
              <div className="flex gap-1">
                {m.role === 'MEMBER' ? (
                  <button
                    onClick={() => startTransition(() => promoteMember(groupId, m.userId))}
                    disabled={isPending}
                    className="rounded px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)] disabled:opacity-50"
                  >
                    Make Admin
                  </button>
                ) : (
                  <button
                    onClick={() => startTransition(() => demoteMember(groupId, m.userId))}
                    disabled={isPending}
                    className="rounded px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)] disabled:opacity-50"
                  >
                    Remove Admin
                  </button>
                )}
                {!isDefault && (
                  <button
                    onClick={() => startTransition(() => removeMember(groupId, m.userId))}
                    disabled={isPending}
                    className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
