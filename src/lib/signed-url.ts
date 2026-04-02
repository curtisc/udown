import { createHmac, timingSafeEqual } from 'crypto'

const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function getSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not set')
  return secret
}

export function generateSignedToken(requestId: string, action: string): string {
  const timestamp = Date.now()
  const payload = `${requestId}:${action}:${timestamp}`
  const hmac = createHmac('sha256', getSecret())
  hmac.update(payload)
  const signature = hmac.digest('hex')
  return Buffer.from(`${payload}:${signature}`).toString('base64url')
}

export function verifySignedToken(
  token: string,
  requestId: string,
  action: string
): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString()
    const parts = decoded.split(':')
    if (parts.length !== 4) return false

    const [tokenRequestId, tokenAction, tokenTimestamp, tokenSignature] = parts
    if (tokenRequestId !== requestId || tokenAction !== action) return false

    const timestamp = parseInt(tokenTimestamp, 10)
    if (isNaN(timestamp) || Date.now() - timestamp > TOKEN_MAX_AGE_MS) return false

    const expectedPayload = `${requestId}:${action}:${tokenTimestamp}`
    const hmac = createHmac('sha256', getSecret())
    hmac.update(expectedPayload)
    const expectedSignature = hmac.digest('hex')

    return timingSafeEqual(
      Buffer.from(tokenSignature),
      Buffer.from(expectedSignature)
    )
  } catch {
    return false
  }
}

export function generateAccessRequestUrl(
  requestId: string,
  action: 'approve' | 'deny'
): string {
  const base = process.env.AUTH_URL || 'http://localhost:3000'
  const token = generateSignedToken(requestId, action)
  return `${base}/api/access-request/${action}/${token}?requestId=${requestId}`
}
