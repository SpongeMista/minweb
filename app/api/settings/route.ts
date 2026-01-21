import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getDefaultUserId } from '@/lib/default-user'
import { z } from 'zod'

const UpdateSchema = z.object({
  hideYoutubeShorts: z.boolean(),
})

export async function GET() {
  try {
    const userId = await getDefaultUserId()

    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    })

    return NextResponse.json({
      hideYoutubeShorts: settings?.hideYoutubeShorts ?? false,
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
    const { hideYoutubeShorts } = UpdateSchema.parse(body)

    const settings = await prisma.userSettings.upsert({
      where: { userId },
      create: { userId, hideYoutubeShorts },
      update: { hideYoutubeShorts },
    })

    return NextResponse.json({ hideYoutubeShorts: settings.hideYoutubeShorts })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.errors }, { status: 400 })
    }
    console.error('Settings API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
