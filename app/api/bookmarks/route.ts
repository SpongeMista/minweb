import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getDefaultUserId } from '@/lib/default-user'

const AddSchema = z.object({
  feedItemId: z.string().min(1),
})

const RemoveSchema = z.object({
  feedItemId: z.string().min(1),
})

export async function GET() {
  try {
    const userId = await getDefaultUserId()
    const bookmarks = await prisma.userBookmark.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        feedItem: true,
      },
    })

    const items = bookmarks
      .map((bookmark) => bookmark.feedItem)
      .filter((item) => item !== null)

    return NextResponse.json({ items })
  } catch (error) {
    console.error('Bookmarks API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getDefaultUserId()
    const body = await request.json()
    const { feedItemId } = AddSchema.parse(body)

    const bookmark = await prisma.userBookmark.upsert({
      where: { userId_feedItemId: { userId, feedItemId } },
      create: { userId, feedItemId },
      update: {},
      include: { feedItem: true },
    })

    await prisma.feedItem.update({
      where: { id: feedItemId },
      data: { deletedAt: new Date() },
    })

    return NextResponse.json({ bookmark })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.errors }, { status: 400 })
    }
    console.error('Bookmarks API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getDefaultUserId()
    const body = await request.json()
    const { feedItemId } = RemoveSchema.parse(body)

    const bookmark = await prisma.userBookmark.delete({
      where: { userId_feedItemId: { userId, feedItemId } },
    })

    await prisma.feedItem.update({
      where: { id: bookmark.feedItemId },
      data: { deletedAt: null },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.errors }, { status: 400 })
    }
    console.error('Bookmarks API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
