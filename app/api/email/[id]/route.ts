import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getDefaultUserId } from '@/lib/default-user'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getDefaultUserId()
    const item = await prisma.feedItem.findFirst({
      where: {
        id: params.id,
        userId,
        source: 'substack',
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ item })
  } catch (error) {
    console.error('Email item API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
