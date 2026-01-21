import { prisma } from '@/lib/db'
import { PaginationParams, PaginatedResponse } from '@/lib/types'

export async function getFeed(
  userId: string,
  params: PaginationParams
): Promise<PaginatedResponse<any>> {
  const limit = Math.min(params.limit || 10, 100) // Default 10 items per page, max 100

  const where: any = {
    userId,
  }

  if (params.source) {
    where.source = params.source
  }

  if (params.hideYoutubeShorts) {
    where.NOT = {
      source: 'youtube',
      durationSeconds: {
        lt: 180,
      },
    }
  }

  // Build cursor pagination conditions
  const cursorConditions: any[] = []
  if (params.cursor) {
    try {
      const decoded = Buffer.from(params.cursor, 'base64').toString('utf-8')
      const [timestamp, id] = decoded.split(':')
      
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
    } catch (error) {
      console.error('Invalid cursor:', error)
      // Invalid cursor, ignore
    }
  }

  // Add cursor pagination conditions
  if (cursorConditions.length > 0) {
    where.AND = [{ OR: cursorConditions }]
  }

  const items = await prisma.feedItem.findMany({
    where,
    orderBy: [
      { publishedAt: 'desc' },
      { id: 'desc' }, // Secondary sort for consistent pagination
    ],
    take: limit + 1, // Fetch one extra to check if there's more
  })

  const hasMore = items.length > limit
  const resultItems = hasMore ? items.slice(0, limit) : items

  // Generate next cursor from last item
  let nextCursor: string | null = null
  if (hasMore && resultItems.length > 0) {
    const lastItem = resultItems[resultItems.length - 1]
    const cursorData = `${lastItem.publishedAt.toISOString()}:${lastItem.id}`
    nextCursor = Buffer.from(cursorData).toString('base64')
  }

  return {
    items: resultItems,
    nextCursor,
    hasMore,
  }
}

