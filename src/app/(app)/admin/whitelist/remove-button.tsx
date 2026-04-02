'use client'

import { useTransition } from 'react'
import { removeWhitelistEntry } from '@/lib/actions/admin'

export function RemoveButton({ entryId }: { entryId: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => startTransition(() => removeWhitelistEntry(entryId))}
      disabled={isPending}
      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
    >
      Remove
    </button>
  )
}
