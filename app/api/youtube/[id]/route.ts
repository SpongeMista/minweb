import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getDefaultUserId } from '@/lib/default-user'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pathnameId = request.nextUrl.pathname.split('/').pop() || ''
    const id = params?.id || pathnameId
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }
    const userId = await getDefaultUserId()
    const item = await prisma.feedItem.findFirst({
      where: {
        id,
        userId,
        source: 'youtube',
        deletedAt: null,
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ item })
  } catch (error) {
    console.error('YouTube item API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
