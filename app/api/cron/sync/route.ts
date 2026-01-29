import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { SubstackConnector } from '@/lib/connectors/substack'
import { YouTubeConnector } from '@/lib/connectors/youtube'
import { RedditConnector } from '@/lib/connectors/reddit'

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
          { redditConnection: { isNot: null } },
        ],
      },
    })

    const results: {
      userId: string
      substack: number
      youtube: number
      reddit: number
      errors: string[]
    }[] = []

    for (const user of users) {
      const userResults = {
        userId: user.id,
        substack: 0,
        youtube: 0,
        reddit: 0,
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

      // Sync Reddit
      try {
        const redditConnector = new RedditConnector()
        const redditItems = await redditConnector.sync(user.id)
        userResults.reddit = redditItems.length
      } catch (error) {
        userResults.errors.push(`Reddit: ${String(error)}`)
      }

      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      await prisma.feedItem.deleteMany({
        where: {
          userId: user.id,
          publishedAt: { lt: cutoff },
          bookmarks: { none: {} },
        },
      })

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

