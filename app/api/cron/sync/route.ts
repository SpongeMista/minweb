import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SubstackConnector } from '@/lib/connectors/substack'
import { YouTubeConnector } from '@/lib/connectors/youtube'

// Vercel Cron compatible route
// Set up in vercel.json or use Vercel Cron dashboard
export async function GET(request: NextRequest) {
  // Verify cron secret (optional but recommended)
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get all users with active sources
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { substackSources: { some: {} } },
          { youtubeConnection: { isNot: null } },
        ],
      },
    })

    const results: { userId: string; substack: number; youtube: number; errors: string[] }[] = []

    for (const user of users) {
      const userResults = {
        userId: user.id,
        substack: 0,
        youtube: 0,
        errors: [] as string[],
      }

      // Sync Substack
      try {
        const substackConnector = new SubstackConnector()
        const substackItems = await substackConnector.sync(user.id)
        userResults.substack = substackItems.length
      } catch (error) {
        userResults.errors.push(`Substack: ${String(error)}`)
      }

      // Sync YouTube
      try {
        const youtubeConnector = new YouTubeConnector()
        const youtubeItems = await youtubeConnector.sync(user.id)
        userResults.youtube = youtubeItems.length
      } catch (error) {
        userResults.errors.push(`YouTube: ${String(error)}`)
      }

      results.push(userResults)
    }

    return NextResponse.json({
      success: true,
      usersProcessed: results.length,
      results,
    })
  } catch (error) {
    console.error('Cron sync error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

