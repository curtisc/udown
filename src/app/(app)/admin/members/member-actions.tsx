'use client'

import { useTransition } from 'react'
import { promoteToOrgAdmin, demoteFromOrgAdmin } from '@/lib/actions/admin'

type Props = {
  userId: string
  role: string
  isOwner: boolean
}

export function MemberActions({ userId, role, isOwner }: Props) {
  const [isPending, startTransition] = useTransition()

  if (isOwner) {
    return <span className="rounded-full bg-[var(--brand-accent)]/20 px-2 py-0.5 text-xs font-medium text-[var(--brand-accent)]">Owner</span>
  }

  return (
    <div className="flex items-center gap-2">
      {role === 'ADMIN' ? (
        <>
          <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-400">Admin</span>
          <button
            onClick={() => startTransition(() => demoteFromOrgAdmin(userId))}
            disabled={isPending}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            Demote
          </button>
        </>
      ) : (
        <button
          onClick={() => startTransition(() => promoteToOrgAdmin(userId))}
          disabled={isPending}
          className="text-xs text-[var(--brand-accent)] hover:underline disabled:opacity-50"
        >
          Make Admin
        </button>
      )}
    </div>
  )
}
