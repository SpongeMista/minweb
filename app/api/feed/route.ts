import { NextRequest, NextResponse } from 'next/server'
import { getFeed } from '@/lib/feed'
import { getDefaultUserId } from '@/lib/default-user'
import { prisma } from '@/lib/db'
import { SubstackConnector } from '@/lib/connectors/substack'
import { YouTubeConnector } from '@/lib/connectors/youtube'
import { RedditConnector } from '@/lib/connectors/reddit'
import { z } from 'zod'

const QuerySchema = z.object({
  cursor: z.string().nullish(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

const parseCursorTimestamp = (cursor?: string | null): Date | null => {
  if (!cursor) return null
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8')
    let timestamp: string | undefined

    if (decoded.startsWith('{')) {
      const parsed = JSON.parse(decoded) as any
      if (parsed?.ts) {
        timestamp = parsed.ts
      } else {
        const candidates: string[] = []
        if (parsed?.youtube?.ts) candidates.push(parsed.youtube.ts)
        if (parsed?.reddit?.ts) candidates.push(parsed.reddit.ts)
        if (parsed?.substack?.ts) candidates.push(parsed.substack.ts)
        if (candidates.length > 0) {
          const minTs = candidates
            .map((value) => new Date(value))
            .filter((date) => !Number.isNaN(date.getTime()))
            .sort((a, b) => a.getTime() - b.getTime())[0]
          timestamp = minTs?.toISOString()
        }
      }
    } else {
      const lastSeparator = decoded.lastIndexOf(':')
      if (lastSeparator > -1) {
        timestamp = decoded.slice(0, lastSeparator)
      }
    }

    if (timestamp) {
      const parsedDate = new Date(timestamp)
      return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
    }
  } catch (error) {
    console.error('Invalid cursor timestamp:', error)
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getDefaultUserId()

    const searchParams = request.nextUrl.searchParams
    // Convert null to undefined for optional params (searchParams.get returns null, not undefined)
    const parsedParams = QuerySchema.parse({
      cursor: searchParams.get('cursor') || undefined,
      limit: searchParams.get('limit') || undefined,
    })

    const [settings, channelCount, userChannels, subredditCount, userSubreddits] = await Promise.all([
      prisma.userSettings.findUnique({
        where: { userId },
      }),
      prisma.userYoutubeChannel.count({ where: { userId } }),
      prisma.userYoutubeChannel.findMany({
        where: { userId },
        select: { channelId: true },
      }),
      prisma.userRedditSubreddit.count({ where: { userId } }),
      prisma.userRedditSubreddit.findMany({
        where: { userId },
        select: { subreddit: true },
      }),
    ])

    const youtubeConnected = channelCount > 0
    const redditConnected = subredditCount > 0
    const hideYoutubeShorts = settings?.hideYoutubeShorts ?? false
    const shortsMinSeconds = settings?.shortsMinSeconds ?? 60
    const hideThumbnails = settings?.hideThumbnails ?? false
    const greyscaleThumbnails = settings?.greyscaleThumbnails ?? false


    // Convert null to undefined to match PaginationParams type
    const params = {
      cursor: parsedParams.cursor ?? undefined,
      limit: parsedParams.limit,
      ...(youtubeConnected || redditConnected ? {} : { source: 'substack' as const }),
      hideYoutubeShorts,
      shortsMinSeconds,
      youtubeChannelIds: userChannels.map((channel) => channel.channelId),
      redditSubreddits: userSubreddits.map((subreddit) => subreddit.subreddit),
    }

    let result = await getFeed(userId, params)
    if (parsedParams.cursor && !result.hasMore) {
      const before = parseCursorTimestamp(parsedParams.cursor)
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      if (before && before > cutoff) {
        const backfillResults: number[] = []
        if (channelCount > 0) {
          const connector = new YouTubeConnector()
          const items = await connector.backfill(userId, before, cutoff)
          backfillResults.push(items.length)
        }
        if (subredditCount > 0) {
          const connector = new RedditConnector()
          const items = await connector.backfill(userId, before, cutoff)
          backfillResults.push(items.length)
        }
        const substackConnector = new SubstackConnector()
        const substackItems = await substackConnector.backfill(userId, before, cutoff)
        backfillResults.push(substackItems.length)

        if (backfillResults.some((count) => count > 0)) {
          result = await getFeed(userId, params)
        }
      }
    }

    return NextResponse.json({ ...result, hideThumbnails, greyscaleThumbnails })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query parameters', details: error.errors }, { status: 400 })
    }
    console.error('Feed API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

