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

    // Convert null to undefined to match PaginationParams type
    const params = {
      cursor: parsedParams.cursor ?? undefined,
      limit: parsedParams.limit,
      ...(youtubeConnected ? {} : { source: 'substack' as const }),
      hideYoutubeShorts,
    }

    const result = await getFeed(userId, params)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query parameters', details: error.errors }, { status: 400 })
    }
    console.error('Feed API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

