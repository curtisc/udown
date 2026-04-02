import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySignedToken } from '@/lib/signed-url'

type Props = {
  params: Promise<{ token: string }>
}

export async function GET(request: Request, { params }: Props) {
  const { token } = await params
  const url = new URL(request.url)
  const requestId = url.searchParams.get('requestId')

  if (!requestId || !verifySignedToken(token, requestId, 'deny')) {
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

  await prisma.accessRequest.update({
    where: { id: requestId },
    data: { status: 'DENIED', respondedAt: new Date() },
  })

  const base = process.env.AUTH_URL || 'http://localhost:3000'
  return NextResponse.redirect(`${base}/admin/access-requests?denied=${accessRequest.email}`)
}
