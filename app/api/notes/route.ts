import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getDefaultUserId } from '@/lib/default-user'

const CreateSchema = z.object({
  feedItemId: z.string().min(1),
  body: z.string().min(1).max(5000),
})

const DeleteSchema = z.object({
  id: z.string().min(1),
})

const UpdateSchema = z.object({
  id: z.string().min(1),
  body: z.string().min(1).max(5000),
})

export async function GET(request: NextRequest) {
  try {
    const userId = await getDefaultUserId()
    const feedItemId = request.nextUrl.searchParams.get('feedItemId')
    if (!feedItemId) {
      return NextResponse.json({ error: 'Missing feedItemId' }, { status: 400 })
    }

    const notes = await prisma.feedItemNote.findMany({
      where: { userId, feedItemId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ notes })
  } catch (error) {
    console.error('Notes GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getDefaultUserId()
    const body = await request.json()
    const { feedItemId, body: noteBody } = CreateSchema.parse(body)

    const feedItem = await prisma.feedItem.findFirst({
      where: { id: feedItemId, userId },
      select: { id: true },
    })
    if (!feedItem) {
      return NextResponse.json({ error: 'Feed item not found' }, { status: 404 })
    }

    const note = await prisma.feedItemNote.create({
      data: {
        userId,
        feedItemId,
        body: noteBody.trim(),
      },
    })

    return NextResponse.json({ note })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.errors }, { status: 400 })
    }
    console.error('Notes POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getDefaultUserId()
    const body = await request.json()
    const { id } = DeleteSchema.parse(body)

    const result = await prisma.feedItemNote.deleteMany({
      where: { id, userId },
    })

    if (result.count === 0) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.errors }, { status: 400 })
    }
    console.error('Notes DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getDefaultUserId()
    const body = await request.json()
    const { id, body: noteBody } = UpdateSchema.parse(body)

    const note = await prisma.feedItemNote.update({
      where: { id, userId },
      data: { body: noteBody.trim() },
    })

    return NextResponse.json({ note })
  } catch (error) {
    if (error instanceof Error && error.name === 'PrismaClientKnownRequestError') {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.errors }, { status: 400 })
    }
    console.error('Notes PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
