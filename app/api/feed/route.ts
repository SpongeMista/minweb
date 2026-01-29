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
    const feedType = settings?.feedType ?? 'balanced'


    // Convert null to undefined to match PaginationParams type
    const params = {
      cursor: parsedParams.cursor ?? undefined,
      limit: parsedParams.limit,
      ...(youtubeConnected || redditConnected ? {} : { source: 'substack' as const }),
      hideYoutubeShorts,
      shortsMinSeconds,
      feedType,
      youtubeChannelIds: userChannels.map((channel) => channel.channelId),
      redditSubreddits: userSubreddits.map((subreddit) => subreddit.subreddit),
    }

    let result = await getFeed(userId, params)
    // #region agent log
    const substackMissing = result.items.filter((item: any) => {
      if (item.source !== 'substack') return false
      const rawImages = Array.isArray(item.rawPayload?.images)
        ? item.rawPayload.images
        : []
      const hasRawImage = rawImages.some((image: string) => typeof image === 'string' && image.startsWith('http'))
      const hasEmailTextFetch =
        typeof item.emailText === 'string' &&
        /substackcdn\.com\/image\/fetch/i.test(item.emailText)
      const hasExcerptFetch =
        typeof item.excerpt === 'string' &&
        /substackcdn\.com\/image\/fetch/i.test(item.excerpt)
      const hasEmailHtmlFetch =
        typeof item.emailHtml === 'string' &&
        /substackcdn\.com\/image\/fetch/i.test(item.emailHtml)
      return !item.thumbnail && !hasRawImage && !hasEmailTextFetch && !hasExcerptFetch && !hasEmailHtmlFetch
    })
    fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H14',location:'app/api/feed/route.ts:109',message:'feed substack missing thumbnails',data:{missingCount:substackMissing.length,missingSample:substackMissing.slice(0,5).map((item:any)=>({id:item.id,hasThumbnail:Boolean(item.thumbnail),hasEmailHtml:Boolean(item.emailHtml),hasEmailText:Boolean(item.emailText),hasExcerpt:Boolean(item.excerpt),rawImages:Array.isArray(item.rawPayload?.images)?item.rawPayload.images.length:0}))},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log

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

    return NextResponse.json({ ...result, hideThumbnails, greyscaleThumbnails, feedType })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query parameters', details: error.errors }, { status: 400 })
    }
    console.error('Feed API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

