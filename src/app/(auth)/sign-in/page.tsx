import { signIn } from '@/lib/auth'
import { getOrgSettings } from '@/lib/org-settings'
import { getEnabledProviderIds } from '@/lib/auth-providers'
import { SubmitButton } from '@/components/ui/submit-button'

const providerMeta: Record<string, { name: string; bg: string; text: string }> =
  {
    google: { name: 'Google', bg: '#4285F4', text: '#ffffff' },
    github: { name: 'GitHub', bg: '#24292e', text: '#ffffff' },
    apple: { name: 'Apple', bg: '#000000', text: '#ffffff' },
    resend: { name: 'Email Magic Link', bg: '#16a0ac', text: '#ffffff' },
  }

export default async function SignInPage() {
  const org = await getOrgSettings()
  const providerIds = getEnabledProviderIds(process.env)

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
      <div className="w-full max-w-sm space-y-8 px-4">
        {org.orgLogo && (
          <img
            src={org.orgLogo}
            alt={org.orgName}
            className="mx-auto h-16 w-auto"
          />
        )}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            {org.orgName}
          </h1>
          <p className="mt-2 text-[var(--text-secondary)]">
            Sign in to see what&apos;s happening
          </p>
        </div>
        <div className="space-y-3">
          {providerIds.map((id) => {
            const meta = providerMeta[id]
            if (!meta) return null
            return (
              <form
                key={id}
                action={async () => {
                  'use server'
                  await signIn(id, { redirectTo: '/feed' })
                }}
              >
                <SubmitButton
                  className="flex w-full items-center justify-center rounded-lg px-4 py-3 font-semibold transition-opacity hover:opacity-90"
                  pendingText="Signing in..."
                  style={{ backgroundColor: meta.bg, color: meta.text }}
                >
                  Sign in with {meta.name}
                </SubmitButton>
              </form>
            )
          })}
        </div>
        {providerIds.length === 0 && (
          <p className="text-center text-sm text-[var(--text-secondary)]">
            No auth providers configured. Set provider credentials in your
            environment variables.
          </p>
        )}
      </div>
    </div>
  )
}
