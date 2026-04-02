import { describe, it, expect } from 'vitest'
import { checkEmailAgainstWhitelist, type WhitelistEntry } from '@/lib/whitelist'

describe('checkEmailAgainstWhitelist', () => {
  const entries: WhitelistEntry[] = [
    { email: 'alice@example.com', type: 'EMAIL' },
    { email: 'berkeley.edu', type: 'DOMAIN' },
  ]

  it('returns true for exact email match', () => {
    expect(checkEmailAgainstWhitelist('alice@example.com', entries)).toBe(true)
  })

  it('returns true for case-insensitive email match', () => {
    expect(checkEmailAgainstWhitelist('Alice@Example.COM', entries)).toBe(true)
  })

  it('returns true for domain match', () => {
    expect(checkEmailAgainstWhitelist('bob@berkeley.edu', entries)).toBe(true)
  })

  it('returns true for case-insensitive domain match', () => {
    expect(checkEmailAgainstWhitelist('bob@Berkeley.EDU', entries)).toBe(true)
  })

  it('returns false for non-matching email', () => {
    expect(checkEmailAgainstWhitelist('bob@other.com', entries)).toBe(false)
  })

  it('returns false for empty whitelist', () => {
    expect(checkEmailAgainstWhitelist('alice@example.com', [])).toBe(false)
  })

  it('returns false for partial domain match', () => {
    expect(checkEmailAgainstWhitelist('bob@notberkeley.edu', entries)).toBe(false)
  })

  it('returns false for subdomain of whitelisted domain', () => {
    expect(checkEmailAgainstWhitelist('bob@sub.berkeley.edu', entries)).toBe(false)
  })
})
