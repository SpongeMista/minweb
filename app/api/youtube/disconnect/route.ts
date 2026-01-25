import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getDefaultUserId } from '@/lib/default-user'

export async function POST() {
  try {
    const userId = await getDefaultUserId()

    await prisma.feedItem.deleteMany({
      where: {
        userId,
        source: 'youtube',
      },
    })

    await prisma.userYoutubeChannel.deleteMany({
      where: { userId },
    })

    await prisma.youtubeConnection.deleteMany({
      where: { userId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('YouTube disconnect error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
