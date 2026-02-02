import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getDefaultUserId } from '@/lib/default-user'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'app/api/feed/[id]/route.ts:9',message:'route params snapshot delete',data:{paramType:typeof params,hasThen:!!(params as any)?.then},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log
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
        deletedAt: null,
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'app/api/feed/[id]/route.ts:46',message:'route params snapshot patch',data:{paramType:typeof params,hasThen:!!(params as any)?.then},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log
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
