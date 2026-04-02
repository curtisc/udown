import Google from 'next-auth/providers/google'
import GitHub from 'next-auth/providers/github'
import Apple from 'next-auth/providers/apple'
import Resend from 'next-auth/providers/resend'
import type { Provider } from 'next-auth/providers'

export function getEnabledProviderIds(
  env: Record<string, string | undefined>
): string[] {
  const ids: string[] = []
  if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) ids.push('google')
  if (env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET) ids.push('github')
  if (env.AUTH_APPLE_ID && env.AUTH_APPLE_SECRET) ids.push('apple')
  if (env.AUTH_EMAIL_ENABLED === 'true' && env.RESEND_API_KEY) ids.push('resend')
  return ids
}

export function getProviders(): Provider[] {
  const providers: Provider[] = []

  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push(Google)
  }
  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(GitHub)
  }
  if (process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET) {
    providers.push(Apple)
  }
  if (process.env.AUTH_EMAIL_ENABLED === 'true' && process.env.RESEND_API_KEY) {
    providers.push(
      Resend({
        apiKey: process.env.RESEND_API_KEY,
        from: process.env.RESEND_FROM_EMAIL || 'noreply@example.com',
      })
    )
  }

  return providers
}
