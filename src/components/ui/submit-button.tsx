'use client'

import { useFormStatus } from 'react-dom'
import { CSSProperties } from 'react'

type Props = {
  children: React.ReactNode
  className?: string
  pendingText?: string
  style?: CSSProperties
}

export function SubmitButton({ children, className, pendingText, style }: Props) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className} ${pending ? 'opacity-50 cursor-not-allowed' : ''}`}
      style={style}
    >
      {pending ? (pendingText || children) : children}
    </button>
  )
}
