type Props = {
  searchParams: Promise<{ email?: string }>
}

export default async function RequestAccessPage({ searchParams }: Props) {
  const { email } = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
      <div className="w-full max-w-sm space-y-6 px-4 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg-surface)]">
          <svg
            className="h-8 w-8 text-[var(--brand-accent)]"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Request Sent
        </h1>
        <p className="text-[var(--text-secondary)]">
          {email
            ? `We've notified the admins about your request for ${email}.`
            : "We've notified the admins about your request."}{' '}
          You&apos;ll get an email when you&apos;re approved.
        </p>
        <a
          href="/sign-in"
          className="inline-block text-[var(--brand-accent)] hover:underline"
        >
          Back to sign in
        </a>
      </div>
    </div>
  )
}
