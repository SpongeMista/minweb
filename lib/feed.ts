import { prisma } from '@/lib/db'
import { PaginationParams, PaginatedResponse } from '@/lib/types'

export async function getFeed(
  userId: string,
  params: PaginationParams
): Promise<PaginatedResponse<any>> {
  const limit = Math.min(params.limit || 10, 100) // Default 10 items per page, max 100

  const baseWhere: any = {
    userId,
    deletedAt: null,
  }

  if (params.source) {
    baseWhere.source = params.source
  }

  if (params.hideYoutubeShorts) {
    const minSeconds = params.shortsMinSeconds ?? 60
    baseWhere.NOT = {
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
      OR: [{ source: 'substack' }, { source: 'reddit' }, ...channelFilters],
    }
    baseWhere.AND = baseWhere.AND ? [...baseWhere.AND, channelScope] : [channelScope]
  }

  if (params.redditSubreddits && params.redditSubreddits.length > 0) {
    const subredditFilters = params.redditSubreddits.map((subreddit) => ({
      source: 'reddit',
      rawPayload: {
        path: ['subreddit'],
        equals: subreddit,
      },
    }))
    const subredditScope = {
      OR: [{ source: 'substack' }, { source: 'youtube' }, ...subredditFilters],
    }
    baseWhere.AND = baseWhere.AND ? [...baseWhere.AND, subredditScope] : [subredditScope]
  }

  type CursorPoint = { ts: string; id: string }
  type PerSourceCursor = {
    youtube?: CursorPoint | null
    reddit?: CursorPoint | null
    substack?: CursorPoint | null
  }
  type ParsedCursor = {
    legacy?: CursorPoint | null
    perSource?: PerSourceCursor | null
  }

  const parseCursor = (cursor?: string): ParsedCursor => {
    if (!cursor) return {}
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8')
      if (decoded.startsWith('{')) {
        const parsed = JSON.parse(decoded) as any
        if (parsed?.ts && parsed?.id) {
          return { legacy: { ts: parsed.ts, id: parsed.id } }
        }
        const perSource: PerSourceCursor = {}
        if (parsed?.youtube?.ts && parsed?.youtube?.id) {
          perSource.youtube = { ts: parsed.youtube.ts, id: parsed.youtube.id }
        }
        if (parsed?.reddit?.ts && parsed?.reddit?.id) {
          perSource.reddit = { ts: parsed.reddit.ts, id: parsed.reddit.id }
        }
        if (parsed?.substack?.ts && parsed?.substack?.id) {
          perSource.substack = { ts: parsed.substack.ts, id: parsed.substack.id }
        }
        return Object.keys(perSource).length > 0 ? { perSource } : {}
      }
      const lastSeparator = decoded.lastIndexOf(':')
      if (lastSeparator > -1) {
        const timestamp = decoded.slice(0, lastSeparator)
        const id = decoded.slice(lastSeparator + 1)
        if (timestamp && id) {
          return { legacy: { ts: timestamp, id } }
        }
      }
    } catch (error) {
      console.error('Invalid cursor:', error)
    }
    return {}
  }

  const parsedCursor = parseCursor(params.cursor)

  const buildCursorCondition = (cursorPoint?: CursorPoint | null) => {
    if (!cursorPoint?.ts || !cursorPoint?.id) return null
    return {
      OR: [
        { publishedAt: { lt: new Date(cursorPoint.ts) } },
        {
          publishedAt: new Date(cursorPoint.ts),
          id: { lt: cursorPoint.id },
        },
      ],
    }
  }

  const cloneBaseWhere = (overrides?: Record<string, unknown>) => {
    const nextWhere: any = { ...baseWhere, ...(overrides ?? {}) }
    if (baseWhere.AND) {
      nextWhere.AND = [...baseWhere.AND]
    }
    return nextWhere
  }

  const withCursor = (whereClause: any, cursorPoint?: CursorPoint | null) => {
    const cursorCondition = buildCursorCondition(cursorPoint)
    if (!cursorCondition) return whereClause
    return {
      ...whereClause,
      AND: whereClause.AND ? [...whereClause.AND, cursorCondition] : [cursorCondition],
    }
  }

  const getOldestCursor = (perSource?: PerSourceCursor | null): CursorPoint | null => {
    if (!perSource) return null
    const entries = Object.values(perSource).filter(Boolean) as CursorPoint[]
    if (entries.length === 0) return null
    return entries.reduce((oldest, current) => {
      if (!oldest) return current
      const oldestTime = new Date(oldest.ts).getTime()
      const currentTime = new Date(current.ts).getTime()
      if (currentTime < oldestTime) return current
      if (currentTime > oldestTime) return oldest
      return current.id < oldest.id ? current : oldest
    }, entries[0])
  }

  const loadItems = async (whereClause: any, take: number) =>
    prisma.feedItem.findMany({
      where: whereClause,
      orderBy: [
        { publishedAt: 'desc' },
        { id: 'desc' }, // Secondary sort for consistent pagination
      ],
      include: {
        _count: {
          select: {
            bookmarks: true,
            notes: true,
          },
        },
      },
      take,
    })

  const nonBalancedCursor =
    parsedCursor.legacy ?? getOldestCursor(parsedCursor.perSource)
  const items = await loadItems(
    withCursor(cloneBaseWhere(), nonBalancedCursor),
    limit + 1
  )

  const hasMore = items.length > limit
  const resultItems = hasMore ? items.slice(0, limit) : items
  const mappedItems = resultItems.map((item: any) => {
    const counts = item?._count ?? {}
    const { _count, ...rest } = item
    return {
      ...rest,
      bookmarkCount: counts.bookmarks ?? 0,
      notesCount: counts.notes ?? 0,
    }
  })

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
    items: mappedItems,
    nextCursor,
    hasMore,
  }
}

