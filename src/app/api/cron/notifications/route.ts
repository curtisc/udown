import { NextResponse } from 'next/server'
import { sendEventReminders } from '@/lib/notifications/triggers'
import { sendInactivityNudges } from '@/lib/notifications/inactivity-nudge'
import { prisma } from '@/lib/prisma'
import { generateSeriesInstances } from '@/lib/actions/series'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const remindersCount = await sendEventReminders()

    // Generate upcoming recurring event instances
    const activeSeries = await prisma.eventSeries.findMany({
      where: { OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] },
      select: { id: true },
    })
    let instancesGenerated = 0
    for (const series of activeSeries) {
      instancesGenerated += await generateSeriesInstances(series.id, 8)
    }

    // Send inactivity nudges
    const nudgesCount = await sendInactivityNudges()

    return NextResponse.json({
      ok: true,
      reminders: remindersCount,
      instances: instancesGenerated,
      nudges: nudgesCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
