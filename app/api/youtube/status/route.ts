import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getDefaultUserId } from '@/lib/default-user'

export async function GET() {
  try {
    const userId = await getDefaultUserId()

    const [connection, channelCount] = await Promise.all([
      prisma.youtubeConnection.findUnique({ where: { userId } }),
      prisma.userYoutubeChannel.count({ where: { userId } }),
    ])

    return NextResponse.json({
      connected: channelCount > 0,
      channelCount,
      lastSyncedAt: connection?.lastSyncedAt || null,
    })
  } catch (error) {
    console.error('YouTube status API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

