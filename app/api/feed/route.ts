import { NextRequest, NextResponse } from 'next/server'
import { getFeed } from '@/lib/feed'
import { getDefaultUserId } from '@/lib/default-user'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const QuerySchema = z.object({
  cursor: z.string().nullish(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const userId = await getDefaultUserId()

    const searchParams = request.nextUrl.searchParams
    // Convert null to undefined for optional params (searchParams.get returns null, not undefined)
    const parsedParams = QuerySchema.parse({
      cursor: searchParams.get('cursor') || undefined,
      limit: searchParams.get('limit') || undefined,
    })

    const [account, settings] = await Promise.all([
      prisma.account.findFirst({
        where: {
          userId,
          provider: 'google',
        },
      }),
      prisma.userSettings.findUnique({
        where: { userId },
      }),
    ])

    const youtubeConnected = !!account?.access_token
    const hideYoutubeShorts = settings?.hideYoutubeShorts ?? false
    const shortsMinSeconds = settings?.shortsMinSeconds ?? 60
    const hideThumbnails = settings?.hideThumbnails ?? false
    const greyscaleThumbnails = settings?.greyscaleThumbnails ?? false
    const [totalItems, youtubeItems, substackItems] = await Promise.all([
      prisma.feedItem.count({ where: { userId, deletedAt: null } }),
      prisma.feedItem.count({ where: { userId, deletedAt: null, source: 'youtube' } }),
      prisma.feedItem.count({ where: { userId, deletedAt: null, source: 'substack' } }),
    ])
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'app/api/feed/route.ts:38',
        message: 'feed:requestSettings',
        data: {
          cursor: parsedParams.cursor ?? null,
          limit: parsedParams.limit ?? null,
          youtubeConnected,
          hideYoutubeShorts,
          shortsMinSeconds,
          hideThumbnails,
          greyscaleThumbnails,
          totalItems,
          youtubeItems,
          substackItems,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'feed-empty-1',
        hypothesisId: 'H2',
      }),
    }).catch(() => {})
    // #endregion

    // Convert null to undefined to match PaginationParams type
    const params = {
      cursor: parsedParams.cursor ?? undefined,
      limit: parsedParams.limit,
      ...(youtubeConnected ? {} : { source: 'substack' as const }),
      hideYoutubeShorts,
      shortsMinSeconds,
    }

    const result = await getFeed(userId, params)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'app/api/feed/route.ts:57',
        message: 'feed:responseSummary',
        data: {
          itemCount: result.items.length,
          hasMore: result.hasMore,
          hasNextCursor: !!result.nextCursor,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'feed-empty-1',
        hypothesisId: 'H3',
      }),
    }).catch(() => {})
    // #endregion
    return NextResponse.json({ ...result, hideThumbnails, greyscaleThumbnails })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query parameters', details: error.errors }, { status: 400 })
    }
    console.error('Feed API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

