import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getDefaultUserId } from '@/lib/default-user'

const AddSchema = z.object({
  subreddit: z.string().min(1),
  title: z.string().min(1),
  icon: z.string().url().nullable().optional(),
  sort: z.enum(['new', 'hot', 'top']).optional(),
})

const RemoveSchema = z.object({
  subreddit: z.string().min(1),
})

const normalizeSubreddit = (value: string) => {
  const trimmed = value.trim().replace(/^\/?r\//i, '')
  return trimmed.toLowerCase()
}

export async function GET() {
  try {
    const userId = await getDefaultUserId()
    const subreddits = await prisma.userRedditSubreddit.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ subreddits })
  } catch (error) {
    console.error('Reddit subreddits API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getDefaultUserId()
    const body = await request.json()
    const { subreddit, title, icon, sort } = AddSchema.parse(body)
    const normalized = normalizeSubreddit(subreddit)
    const subredditEntry = await prisma.userRedditSubreddit.upsert({
      where: { userId_subreddit: { userId, subreddit: normalized } },
      create: {
        userId,
        subreddit: normalized,
        title,
        icon: icon ?? null,
        sort: sort ?? 'new',
      },
      update: { title, icon: icon ?? null, ...(sort ? { sort } : {}) },
    })
    return NextResponse.json({ subreddit: subredditEntry })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.errors }, { status: 400 })
    }
    console.error('Reddit subreddits API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getDefaultUserId()
    const body = await request.json()
    const { subreddit } = RemoveSchema.parse(body)
    const normalized = normalizeSubreddit(subreddit)
    await prisma.userRedditSubreddit.delete({
      where: { userId_subreddit: { userId, subreddit: normalized } },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.errors }, { status: 400 })
    }
    console.error('Reddit subreddits API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
