import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getDefaultUserId } from '@/lib/default-user'
import { z } from 'zod'

const UpdateSchema = z.object({
  hideYoutubeShorts: z.boolean().optional(),
  shortsMinSeconds: z.number().int().min(1).max(3600).optional(),
  hideThumbnails: z.boolean().optional(),
  greyscaleThumbnails: z.boolean().optional(),
  feedType: z.enum(['chronological', 'balanced']).optional(),
})

export async function GET() {
  try {
    const userId = await getDefaultUserId()

    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    })

    return NextResponse.json({
      hideYoutubeShorts: settings?.hideYoutubeShorts ?? false,
      shortsMinSeconds: settings?.shortsMinSeconds ?? 60,
      hideThumbnails: settings?.hideThumbnails ?? false,
      greyscaleThumbnails: settings?.greyscaleThumbnails ?? false,
      feedType: settings?.feedType ?? 'balanced',
    })
  } catch (error) {
    console.error('Settings API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await getDefaultUserId()
    const body = await request.json()
    const { hideYoutubeShorts, shortsMinSeconds, hideThumbnails, greyscaleThumbnails, feedType } =
      UpdateSchema.parse(body)

    const settings = await prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        hideYoutubeShorts: hideYoutubeShorts ?? false,
        shortsMinSeconds: shortsMinSeconds ?? 60,
        hideThumbnails: hideThumbnails ?? false,
        greyscaleThumbnails: greyscaleThumbnails ?? false,
        feedType: feedType ?? 'balanced',
      },
      update: {
        ...(hideYoutubeShorts !== undefined ? { hideYoutubeShorts } : {}),
        ...(shortsMinSeconds !== undefined ? { shortsMinSeconds } : {}),
        ...(hideThumbnails !== undefined ? { hideThumbnails } : {}),
        ...(greyscaleThumbnails !== undefined ? { greyscaleThumbnails } : {}),
        ...(feedType !== undefined ? { feedType } : {}),
      },
    })

    return NextResponse.json({
      hideYoutubeShorts: settings.hideYoutubeShorts,
      shortsMinSeconds: settings.shortsMinSeconds,
      hideThumbnails: settings.hideThumbnails,
      greyscaleThumbnails: settings.greyscaleThumbnails,
      feedType: settings.feedType,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.errors }, { status: 400 })
    }
    console.error('Settings API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
