import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getDefaultUserId } from '@/lib/default-user'

export async function GET() {
  try {
    const userId = await getDefaultUserId()

    // Check if user has Google OAuth account
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: 'google',
      },
    })

    const connection = await prisma.youtubeConnection.findUnique({
      where: { userId },
    })

    return NextResponse.json({
      connected: !!account && !!account.access_token,
      lastSyncedAt: connection?.lastSyncedAt || null,
    })
  } catch (error) {
    console.error('YouTube status API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

