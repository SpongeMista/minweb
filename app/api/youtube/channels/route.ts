import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getDefaultUserId } from '@/lib/default-user'

const AddSchema = z.object({
  channelId: z.string().min(1),
  channelTitle: z.string().min(1),
  thumbnail: z.string().url().nullable().optional(),
})

const RemoveSchema = z.object({
  channelId: z.string().min(1),
})

export async function GET() {
  try {
    const userId = await getDefaultUserId()
    const channels = await prisma.userYoutubeChannel.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ channels })
  } catch (error) {
    console.error('YouTube channels API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getDefaultUserId()
    const body = await request.json()
    const { channelId, channelTitle, thumbnail } = AddSchema.parse(body)
    const channel = await prisma.userYoutubeChannel.upsert({
      where: { userId_channelId: { userId, channelId } },
      create: { userId, channelId, channelTitle, thumbnail: thumbnail ?? null },
      update: { channelTitle, thumbnail: thumbnail ?? null },
    })
    return NextResponse.json({ channel })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.errors }, { status: 400 })
    }
    console.error('YouTube channels API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getDefaultUserId()
    const body = await request.json()
    const { channelId } = RemoveSchema.parse(body)
    await prisma.userYoutubeChannel.delete({
      where: { userId_channelId: { userId, channelId } },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.errors }, { status: 400 })
    }
    console.error('YouTube channels API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
