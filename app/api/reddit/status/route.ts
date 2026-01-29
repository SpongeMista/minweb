import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getDefaultUserId } from '@/lib/default-user'

export async function GET() {
  try {
    const userId = await getDefaultUserId()

    const [connection, subredditCount] = await Promise.all([
      prisma.redditConnection.findUnique({ where: { userId } }),
      prisma.userRedditSubreddit.count({ where: { userId } }),
    ])

    return NextResponse.json({
      connected: subredditCount > 0,
      subredditCount,
      lastSyncedAt: connection?.lastSyncedAt || null,
    })
  } catch (error) {
    console.error('Reddit status API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
