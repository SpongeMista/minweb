import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getDefaultUserId } from '@/lib/default-user'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getDefaultUserId()
    const pathnameId = request.nextUrl.pathname.split('/').pop() || ''
    const id = params?.id || pathnameId

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const result = await prisma.feedItem.updateMany({
      where: {
        id,
        userId,
      },
      data: {
        deletedAt: new Date(),
      },
    })

    if (result.count === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Feed item delete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getDefaultUserId()
    const pathnameId = request.nextUrl.pathname.split('/').pop() || ''
    const id = params?.id || pathnameId

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const result = await prisma.feedItem.updateMany({
      where: {
        id,
        userId,
        deletedAt: { not: null },
      },
      data: {
        deletedAt: null,
      },
    })

    if (result.count === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Feed item restore error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
