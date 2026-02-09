import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getDefaultUserId } from '@/lib/default-user'

const CreateSchema = z.object({
  feedItemId: z.string().min(1),
  startOffset: z.number().int().min(0),
  endOffset: z.number().int().min(0),
  text: z.string().min(1).max(5000),
})

const DeleteSchema = z.object({
  id: z.string().min(1),
})

export async function GET(request: NextRequest) {
  try {
    const userId = await getDefaultUserId()
    const feedItemId = request.nextUrl.searchParams.get('feedItemId')
    if (!feedItemId) {
      return NextResponse.json({ error: 'Missing feedItemId' }, { status: 400 })
    }
    const highlights = await prisma.highlight.findMany({
      where: { userId, feedItemId },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ highlights })
  } catch (error) {
    console.error('Highlights GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getDefaultUserId()
    const body = await request.json()
    const { feedItemId, startOffset, endOffset, text } = CreateSchema.parse(body)

    if (endOffset <= startOffset) {
      return NextResponse.json({ error: 'Invalid highlight range' }, { status: 400 })
    }
    const feedItem = await prisma.feedItem.findFirst({
      where: { id: feedItemId, userId },
      select: { id: true },
    })
    if (!feedItem) {
      return NextResponse.json({ error: 'Feed item not found' }, { status: 404 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const highlight = await tx.highlight.create({
        data: {
          userId,
          feedItemId,
          startOffset,
          endOffset,
          text: text.trim(),
        },
      })
      const note = await tx.feedItemNote.create({
        data: {
          userId,
          feedItemId,
          body: text.trim(),
          highlightId: highlight.id,
        },
        include: { highlight: true },
      })
      return { highlight, note }
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.errors }, { status: 400 })
    }
    console.error('Highlights POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getDefaultUserId()
    const body = await request.json()
    const { id } = DeleteSchema.parse(body)

    const highlight = await prisma.highlight.findFirst({
      where: { id, userId },
      select: { id: true },
    })
    if (!highlight) {
      return NextResponse.json({ error: 'Highlight not found' }, { status: 404 })
    }

    await prisma.highlight.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.errors }, { status: 400 })
    }
    console.error('Highlights DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
