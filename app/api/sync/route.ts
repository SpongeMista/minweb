import { NextRequest, NextResponse } from 'next/server'
import { SubstackConnector } from '@/lib/connectors/substack'
import { YouTubeConnector } from '@/lib/connectors/youtube'
import { RedditConnector } from '@/lib/connectors/reddit'
import { prisma } from '@/lib/db'
import { getDefaultUserId } from '@/lib/default-user'
import { z } from 'zod'

const BodySchema = z.object({
  source: z.enum(['substack', 'youtube', 'reddit', 'all']).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const userId = await getDefaultUserId()

    const body = await request.json().catch(() => ({}))
    const { source } = BodySchema.parse(body)
    const results: { source: string; count: number; error?: string }[] = []

    if (!source || source === 'substack' || source === 'all') {
      try {
        const connector = new SubstackConnector()
        const items = await connector.sync(userId)
        results.push({ source: 'substack', count: items.length })
      } catch (error) {
        results.push({ source: 'substack', count: 0, error: String(error) })
      }
    }

    if (!source || source === 'youtube' || source === 'all') {
      try {
        const connector = new YouTubeConnector()
        const items = await connector.sync(userId)
        results.push({ source: 'youtube', count: items.length })
      } catch (error) {
        results.push({ source: 'youtube', count: 0, error: String(error) })
      }
    }

    if (!source || source === 'reddit' || source === 'all') {
      try {
        const connector = new RedditConnector()
        const items = await connector.sync(userId)
        results.push({ source: 'reddit', count: items.length })
      } catch (error) {
        results.push({ source: 'reddit', count: 0, error: String(error) })
      }
    }

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    await prisma.feedItem.deleteMany({
      where: {
        userId,
        publishedAt: { lt: cutoff },
        bookmarks: { none: {} },
      },
    })

    return NextResponse.json({ success: true, results })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.errors }, { status: 400 })
    }
    console.error('Sync API error:', error)
    return NextResponse.json({ error: 'Internal server error', detail: String(error) }, { status: 500 })
  }
}

