import { describe, it, expect } from 'vitest'
import { getEnabledProviderIds } from '@/lib/auth-providers'

describe('getEnabledProviderIds', () => {
  it('returns empty array when no providers configured', () => {
    expect(getEnabledProviderIds({})).toEqual([])
  })

  it('includes google when both credentials present', () => {
    const env = { AUTH_GOOGLE_ID: 'id', AUTH_GOOGLE_SECRET: 'secret' }
    expect(getEnabledProviderIds(env)).toContain('google')
  })

  it('excludes google when only ID present', () => {
    const env = { AUTH_GOOGLE_ID: 'id' }
    expect(getEnabledProviderIds(env)).not.toContain('google')
  })

  it('includes github when both credentials present', () => {
    const env = { AUTH_GITHUB_ID: 'id', AUTH_GITHUB_SECRET: 'secret' }
    expect(getEnabledProviderIds(env)).toContain('github')
  })

  it('excludes github when only secret present', () => {
    const env = { AUTH_GITHUB_SECRET: 'secret' }
    expect(getEnabledProviderIds(env)).not.toContain('github')
  })

  it('includes apple when both credentials present', () => {
    const env = { AUTH_APPLE_ID: 'id', AUTH_APPLE_SECRET: 'secret' }
    expect(getEnabledProviderIds(env)).toContain('apple')
  })

  it('includes resend when enabled flag and API key present', () => {
    const env = { AUTH_EMAIL_ENABLED: 'true', RESEND_API_KEY: 'key' }
    expect(getEnabledProviderIds(env)).toContain('resend')
  })

  it('excludes resend when enabled flag is not "true"', () => {
    const env = { AUTH_EMAIL_ENABLED: 'false', RESEND_API_KEY: 'key' }
    expect(getEnabledProviderIds(env)).not.toContain('resend')
  })

  it('excludes resend when API key missing', () => {
    const env = { AUTH_EMAIL_ENABLED: 'true' }
    expect(getEnabledProviderIds(env)).not.toContain('resend')
  })

  it('includes multiple providers simultaneously', () => {
    const env = {
      AUTH_GOOGLE_ID: 'id',
      AUTH_GOOGLE_SECRET: 'secret',
      AUTH_GITHUB_ID: 'id',
      AUTH_GITHUB_SECRET: 'secret',
    }
    const ids = getEnabledProviderIds(env)
    expect(ids).toEqual(['google', 'github'])
  })
})
