import { NextRequest, NextResponse } from 'next/server'
import { getEmailService } from '@/lib/services/email-service'
import { parseEmail, emailToFeedItem } from '@/lib/parsers/email-parser'
import { prisma } from '@/lib/db'
import { getDefaultUserId } from '@/lib/default-user'

function isWebhookVerificationEnabled() {
  return (process.env.RESEND_WEBHOOK_ENABLED || 'true').toLowerCase() === 'true'
}

function safeDomain(email: string) {
  const at = email.indexOf('@')
  return at >= 0 ? email.slice(at + 1) : 'unknown'
}

export async function handleResendInbound(request: NextRequest) {
  try {
    const emailService = getEmailService()
    if (!emailService) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 503 })
    }

    const signature = request.headers.get('x-resend-signature') || ''
    const svixSignature = request.headers.get('svix-signature') || ''
    const verificationEnabled = isWebhookVerificationEnabled()

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    if (verificationEnabled) {
      if (!signature && !svixSignature) {
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
      }
      if (signature && !emailService.verifyWebhook(body, signature)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const emailData = body.data?.record || body.data || body
    const eventType = body.type || body.event || 'unknown'
    const messageId = emailData?.id || emailData?.message_id || null
    const toEmail = Array.isArray(emailData.to)
      ? emailData.to[0]
      : (emailData.to || emailData.recipient || '')
    const rawEmail = emailData.raw || emailData

    const source = await prisma.substackSource.findUnique({
      where: { subscriptionEmail: toEmail },
    })

    if (!source) {
      return NextResponse.json({ success: true, message: 'Ignored - no subscription found' })
    }

    let parsedEmail
    if (typeof rawEmail === 'string') {
      parsedEmail = await parseEmail(Buffer.from(rawEmail))
    } else if (emailData.html || emailData.text || emailData.text_plain) {
      const htmlContent = emailData.html || emailData.text_html || ''
      const textContent = emailData.text || emailData.text_plain || ''
      parsedEmail = {
        subject: emailData.subject || 'No Subject',
        from: typeof emailData.from === 'string'
          ? emailData.from
          : (emailData.from?.email || emailData.from?.address || ''),
        fromName: emailData.from?.name,
        date: emailData.created_at
          ? new Date(emailData.created_at)
          : (emailData.date ? new Date(emailData.date) : new Date()),
        textContent,
        htmlContent: htmlContent || undefined,
        links: [],
        images: [],
      }
    } else {
      parsedEmail = {
        subject: emailData.subject || 'No Subject',
        from: typeof emailData.from === 'string'
          ? emailData.from
          : (emailData.from?.email || emailData.from?.address || ''),
        fromName: emailData.from?.name,
        date: emailData.created_at
          ? new Date(emailData.created_at)
          : (emailData.date ? new Date(emailData.date) : new Date()),
        textContent: '',
        htmlContent: undefined,
        links: [],
        images: [],
      }
    }

    const feedItem = emailToFeedItem(parsedEmail, source.publicationName)
    const userId = await getDefaultUserId()

    await prisma.feedItem.upsert({
      where: {
        userId_source_sourceId: {
          userId,
          source: 'substack',
          sourceId: feedItem.sourceId,
        },
      },
      update: {
        title: feedItem.title,
        author: feedItem.author,
        publishedAt: feedItem.publishedAt,
        excerpt: feedItem.excerpt,
        url: feedItem.url,
        thumbnail: feedItem.thumbnail,
        rawPayload: feedItem.rawPayload as any,
        updatedAt: new Date(),
      },
      create: {
        userId,
        source: feedItem.source,
        sourceId: feedItem.sourceId,
        title: feedItem.title,
        author: feedItem.author,
        publishedAt: feedItem.publishedAt,
        excerpt: feedItem.excerpt,
        url: feedItem.url,
        thumbnail: feedItem.thumbnail,
        rawPayload: feedItem.rawPayload as any,
      },
    })

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/handlers/resend-inbound.ts:104',message:'Feed item upserted',data:{sourceId:feedItem.sourceId,userId},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H5'})}).catch(()=>{});
    // #endregion

    await prisma.substackSource.update({
      where: { id: source.id },
      data: { lastSyncedAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Resend inbound error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
