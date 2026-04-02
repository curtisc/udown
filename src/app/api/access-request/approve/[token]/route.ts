import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySignedToken } from '@/lib/signed-url'
import { notifyAccessApproved } from '@/lib/notifications/access-request-email'

type Props = {
  params: Promise<{ token: string }>
}

export async function GET(request: Request, { params }: Props) {
  const { token } = await params
  const url = new URL(request.url)
  const requestId = url.searchParams.get('requestId')

  if (!requestId || !verifySignedToken(token, requestId, 'approve')) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 })
  }

  const accessRequest = await prisma.accessRequest.findUnique({
    where: { id: requestId },
  })
  if (!accessRequest) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }
  if (accessRequest.status !== 'PENDING') {
    return NextResponse.json({ error: `Request already ${accessRequest.status.toLowerCase()}` }, { status: 400 })
  }

  // Add email to whitelist
  await prisma.emailWhitelist.upsert({
    where: { email_type: { email: accessRequest.email, type: 'EMAIL' } },
    update: {},
    create: { email: accessRequest.email, type: 'EMAIL' },
  })

  // Update access request status
  await prisma.accessRequest.update({
    where: { id: requestId },
    data: { status: 'APPROVED', respondedAt: new Date() },
  })

  // Send welcome email
  void notifyAccessApproved(accessRequest.email).catch(console.error)

  // Redirect to a success page
  const base = process.env.AUTH_URL || 'http://localhost:3000'
  return NextResponse.redirect(`${base}/admin/access-requests?approved=${accessRequest.email}`)
}
