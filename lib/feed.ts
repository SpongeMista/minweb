import { prisma } from '@/lib/db'
import { PaginationParams, PaginatedResponse } from '@/lib/types'

export async function getFeed(
  userId: string,
  params: PaginationParams
): Promise<PaginatedResponse<any>> {
  const limit = Math.min(params.limit || 10, 100) // Default 10 items per page, max 100
  const shouldBalance =
    params.feedType === 'balanced' &&
    !params.source

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
      take,
    })

  const hashString = (value: string) => {
    let hash = 0x811c9dc5
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i)
      hash = Math.imul(hash, 0x01000193)
      hash >>>= 0
    }
    return hash >>> 0
  }

  const mulberry32 = (seed: number) => {
    let t = seed >>> 0
    return () => {
      t += 0x6d2b79f5
      let r = t
      r = Math.imul(r ^ (r >>> 15), r | 1)
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296
    }
  }

  const shuffleDeterministic = <T>(items: T[], seedInput: string) => {
    const output = [...items]
    const rng = mulberry32(hashString(seedInput))
    for (let i = output.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1))
      const temp = output[i]
      output[i] = output[j]
      output[j] = temp
    }
    return output
  }

  if (shouldBalance) {
    const weights = {
      youtube: 0.5,
      reddit: 0.3,
      substack: 0.2,
    }

    const rawQuotas = {
      youtube: Math.floor(limit * weights.youtube),
      reddit: Math.floor(limit * weights.reddit),
      substack: Math.floor(limit * weights.substack),
    }
    const remainder = limit - (rawQuotas.youtube + rawQuotas.reddit + rawQuotas.substack)
    const remainderOrder: Array<'youtube' | 'reddit' | 'substack'> = [
      'youtube',
      'reddit',
      'substack',
    ]
    for (let i = 0; i < remainder; i += 1) {
      const key = remainderOrder[i % remainderOrder.length]
      rawQuotas[key] += 1
    }

    const getSourceCursor = (source: keyof PerSourceCursor) =>
      parsedCursor.perSource?.[source] ?? parsedCursor.legacy ?? null
    const buffer = 2
    const [youtubeItems, redditItems, substackItems] = await Promise.all([
      loadItems(
        withCursor(cloneBaseWhere({ source: 'youtube' }), getSourceCursor('youtube')),
        rawQuotas.youtube + buffer
      ),
      loadItems(
        withCursor(cloneBaseWhere({ source: 'reddit' }), getSourceCursor('reddit')),
        rawQuotas.reddit + buffer
      ),
      loadItems(
        withCursor(cloneBaseWhere({ source: 'substack' }), getSourceCursor('substack')),
        rawQuotas.substack + buffer
      ),
    ])

    const pickWithQuota = (
      items: any[],
      target: number
    ) => items.slice(0, Math.max(0, target))

    const selected = [
      ...pickWithQuota(youtubeItems, rawQuotas.youtube),
      ...pickWithQuota(redditItems, rawQuotas.reddit),
      ...pickWithQuota(substackItems, rawQuotas.substack),
    ]

    const selectedIds = new Set(selected.map((item) => item.id))
    const pool = [
      ...youtubeItems,
      ...redditItems,
      ...substackItems,
    ].filter((item) => !selectedIds.has(item.id))

    const merged = [...selected, ...pool].sort(
      (a, b) =>
        b.publishedAt.getTime() - a.publishedAt.getTime() ||
        (a.id < b.id ? 1 : -1)
    )

    const resultItems = merged.slice(0, limit)
    const shuffleSeed = `${userId}:${params.cursor ?? 'initial'}:${limit}`
    const shuffledItems = shuffleDeterministic(resultItems, shuffleSeed)
    const hasMoreBySource =
      youtubeItems.length > rawQuotas.youtube ||
      redditItems.length > rawQuotas.reddit ||
      substackItems.length > rawQuotas.substack
    const hasMore = merged.length > limit || hasMoreBySource

    const getOldestBySource = (items: any[], source: 'youtube' | 'reddit' | 'substack') => {
      return items
        .filter((item) => item.source === source)
        .reduce<CursorPoint | null>((oldest, current) => {
          const currentPoint = {
            ts: current.publishedAt.toISOString(),
            id: current.id,
          }
          if (!oldest) return currentPoint
          const oldestTime = new Date(oldest.ts).getTime()
          const currentTime = new Date(currentPoint.ts).getTime()
          if (currentTime < oldestTime) return currentPoint
          if (currentTime > oldestTime) return oldest
          return currentPoint.id < oldest.id ? currentPoint : oldest
        }, null)
    }

    let nextCursor: string | null = null
    if (hasMore) {
      const nextPayload: PerSourceCursor = {
        youtube:
          getOldestBySource(resultItems, 'youtube') ??
          parsedCursor.perSource?.youtube ??
          parsedCursor.legacy ??
          null,
        reddit:
          getOldestBySource(resultItems, 'reddit') ??
          parsedCursor.perSource?.reddit ??
          parsedCursor.legacy ??
          null,
        substack:
          getOldestBySource(resultItems, 'substack') ??
          parsedCursor.perSource?.substack ??
          parsedCursor.legacy ??
          null,
      }
      if (nextPayload.youtube || nextPayload.reddit || nextPayload.substack) {
        nextCursor = Buffer.from(JSON.stringify(nextPayload)).toString('base64')
      }
    }

    return {
      items: shuffledItems,
      nextCursor,
      hasMore,
    }
  }

  const nonBalancedCursor =
    parsedCursor.legacy ?? getOldestCursor(parsedCursor.perSource)
  const items = await loadItems(
    withCursor(cloneBaseWhere(), nonBalancedCursor),
    limit + 1
  )

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

