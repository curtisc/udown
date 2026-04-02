import Link from 'next/link'
import { ThemeToggle } from './theme-toggle'

type HeaderProps = {
  userName?: string | null
  userImage?: string | null
  orgName: string
  isAdmin?: boolean
}

export function Header({ userName, userImage, orgName, isAdmin }: HeaderProps) {
  return (
    <header className="border-b border-[var(--bg-surface)] bg-[var(--bg-card)]">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/feed" className="text-lg font-bold text-[var(--brand-accent)]">
            {orgName}
          </Link>
          <nav className="flex gap-3">
            <Link
              href="/feed"
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Feed
            </Link>
            <Link
              href="/groups"
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Groups
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Admin
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/settings">
            {userImage ? (
              <img
                src={userImage}
                alt={userName || ''}
                className="h-8 w-8 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-accent)] text-sm font-bold text-white">
                {(userName || '?')[0].toUpperCase()}
              </div>
            )}
          </Link>
        </div>
      </div>
    </header>
  )
}
