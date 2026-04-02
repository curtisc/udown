import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateSignedToken, verifySignedToken } from '@/lib/signed-url'

describe('signed URL tokens', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_SECRET', 'test-secret-key-for-hmac')
  })

  it('generates a non-empty token', () => {
    const token = generateSignedToken('request-123', 'approve')
    expect(token).toBeTruthy()
    expect(typeof token).toBe('string')
  })

  it('verifies a valid token', () => {
    const token = generateSignedToken('request-123', 'approve')
    expect(verifySignedToken(token, 'request-123', 'approve')).toBe(true)
  })

  it('rejects a token with wrong request ID', () => {
    const token = generateSignedToken('request-123', 'approve')
    expect(verifySignedToken(token, 'request-456', 'approve')).toBe(false)
  })

  it('rejects a token with wrong action', () => {
    const token = generateSignedToken('request-123', 'approve')
    expect(verifySignedToken(token, 'request-123', 'deny')).toBe(false)
  })

  it('rejects a tampered token', () => {
    expect(verifySignedToken('tampered-token', 'request-123', 'approve')).toBe(false)
  })

  it('generates different tokens for different inputs', () => {
    const token1 = generateSignedToken('request-123', 'approve')
    const token2 = generateSignedToken('request-123', 'deny')
    expect(token1).not.toBe(token2)
  })

  it('rejects an expired token (older than 7 days)', () => {
    // Freeze time 8 days in the past when generating the token
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
    vi.spyOn(Date, 'now').mockReturnValueOnce(eightDaysAgo)
    const token = generateSignedToken('request-123', 'approve')
    vi.restoreAllMocks()
    expect(verifySignedToken(token, 'request-123', 'approve')).toBe(false)
  })

  it('accepts a token generated 6 days ago (within the 7-day window)', () => {
    const sixDaysAgo = Date.now() - 6 * 24 * 60 * 60 * 1000
    vi.spyOn(Date, 'now').mockReturnValueOnce(sixDaysAgo)
    const token = generateSignedToken('request-123', 'approve')
    vi.restoreAllMocks()
    expect(verifySignedToken(token, 'request-123', 'approve')).toBe(true)
  })
})
