import { prisma } from '@/lib/db'
import { PaginationParams, PaginatedResponse } from '@/lib/types'

export async function getFeed(
  userId: string,
  params: PaginationParams
): Promise<PaginatedResponse<any>> {
  const limit = Math.min(params.limit || 10, 100) // Default 10 items per page, max 100

  const where: any = {
    userId,
    deletedAt: null,
  }

  if (params.source) {
    where.source = params.source
  }

  if (params.hideYoutubeShorts) {
    const minSeconds = params.shortsMinSeconds ?? 60
    where.NOT = {
      source: 'youtube',
      durationSeconds: {
        lt: minSeconds,
      },
    }
  }

  if (params.youtubeChannelIds && params.youtubeChannelIds.length > 0) {
    const channelFilters = params.youtubeChannelIds.map((channelId) => ({
      source: 'youtube',
      rawPayload: {
        path: ['snippet', 'channelId'],
        equals: channelId,
      },
    }))
    const channelScope = {
      OR: [{ source: 'substack' }, ...channelFilters],
    }
    where.AND = where.AND ? [...where.AND, channelScope] : [channelScope]
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'lib/feed.ts:40',
        message: 'feed:channelFilterApplied',
        data: {
          channelIds: params.youtubeChannelIds,
          hasCursor: !!params.cursor,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'feed-load-more',
        hypothesisId: 'H2',
      }),
    }).catch(() => {})
    // #endregion
  }

  // Build cursor pagination conditions
  const cursorConditions: any[] = []
  if (params.cursor) {
    try {
      const decoded = Buffer.from(params.cursor, 'base64').toString('utf-8')
      let timestamp: string | undefined
      let id: string | undefined

      if (decoded.startsWith('{')) {
        const parsed = JSON.parse(decoded) as { ts?: string; id?: string }
        timestamp = parsed.ts
        id = parsed.id
      } else {
        const lastSeparator = decoded.lastIndexOf(':')
        if (lastSeparator > -1) {
          timestamp = decoded.slice(0, lastSeparator)
          id = decoded.slice(lastSeparator + 1)
        }
      }
      if (timestamp && id) {
        cursorConditions.push(
          {
            publishedAt: {
              lt: new Date(timestamp),
            },
          },
          {
            publishedAt: new Date(timestamp),
            id: {
              lt: id,
            },
          }
        )
      }
    } catch (error) {
      console.error('Invalid cursor:', error)
      // Invalid cursor, ignore
    }
  }

  // Add cursor pagination conditions
  if (cursorConditions.length > 0) {
    const cursorScope = { OR: cursorConditions }
    where.AND = where.AND ? [...where.AND, cursorScope] : [cursorScope]
  }

  const items = await prisma.feedItem.findMany({
    where,
    orderBy: [
      { publishedAt: 'desc' },
      { id: 'desc' }, // Secondary sort for consistent pagination
    ],
    take: limit + 1, // Fetch one extra to check if there's more
  })

  const youtubeSamples = items
    .filter((item) => item.source === 'youtube')
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      sourceId: item.sourceId,
      channelId:
        typeof item.rawPayload === 'object' && item.rawPayload !== null
          ? (item.rawPayload as any)?.snippet?.channelId ?? null
          : null,
    }))
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'lib/feed.ts:92',
      message: 'feed:pageSample',
      data: {
        total: items.length,
        youtubeSamples,
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'feed-load-more',
      hypothesisId: 'H3',
    }),
  }).catch(() => {})
  // #endregion

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'lib/feed.ts:84',
      message: 'feed:itemsSample',
      data: {
        total: items.length,
        sample: items.slice(0, 5).map((item) => ({
          id: item.id,
          source: item.source,
          sourceId: item.sourceId,
        })),
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'feed-channel-filter',
      hypothesisId: 'H2',
    }),
  }).catch(() => {})
  // #endregion

  const hasMore = items.length > limit
  const resultItems = hasMore ? items.slice(0, limit) : items

  // Generate next cursor from last item
  let nextCursor: string | null = null
  if (hasMore && resultItems.length > 0) {
    const lastItem = resultItems[resultItems.length - 1]
    const cursorData = JSON.stringify({
      ts: lastItem.publishedAt.toISOString(),
      id: lastItem.id,
    })
    nextCursor = Buffer.from(cursorData).toString('base64')
  }

  return {
    items: resultItems,
    nextCursor,
    hasMore,
  }
}

