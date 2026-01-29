import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getDefaultUserId } from '@/lib/default-user'

export async function GET() {
  try {
    const userId = await getDefaultUserId()

    const [youtubeConnection, redditConnection] = await Promise.all([
      prisma.youtubeConnection.findUnique({
        where: { userId },
        select: { lastSyncedAt: true },
      }),
      prisma.redditConnection.findUnique({
        where: { userId },
        select: { lastSyncedAt: true },
      }),
    ])

    const latestSubstack = await prisma.substackSource.findFirst({
      where: { userId },
      orderBy: { lastSyncedAt: 'desc' },
      select: { lastSyncedAt: true },
    })

    const youtubeLastSyncedAt = youtubeConnection?.lastSyncedAt ?? null
    const redditLastSyncedAt = redditConnection?.lastSyncedAt ?? null
    const emailLastSyncedAt = latestSubstack?.lastSyncedAt ?? null

    const candidates = [youtubeLastSyncedAt, redditLastSyncedAt, emailLastSyncedAt].filter(
      (value): value is Date => Boolean(value)
    )

    const lastSyncedAt =
      candidates.length > 0
        ? new Date(Math.max(...candidates.map((value) => value.getTime())))
        : null

    return NextResponse.json({
      lastSyncedAt,
      youtubeLastSyncedAt,
      redditLastSyncedAt,
      emailLastSyncedAt,
    })
  } catch (error) {
    console.error('Sync status API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
