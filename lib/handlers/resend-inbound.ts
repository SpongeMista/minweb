import { NextRequest, NextResponse } from 'next/server'
import { getEmailService } from '@/lib/services/email-service'
import { parseEmail, emailToFeedItem, extractEmailContent, stripSubstackTracking } from '@/lib/parsers/email-parser'
import { prisma } from '@/lib/db'
import { getDefaultUserId } from '@/lib/default-user'

function isWebhookVerificationEnabled() {
  return (process.env.RESEND_WEBHOOK_ENABLED || 'true').toLowerCase() === 'true'
}

function safeDomain(email: string) {
  const at = email.indexOf('@')
  return at >= 0 ? email.slice(at + 1) : 'unknown'
}

async function fetchReceivedEmailContent(emailIds: string[]) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured')
  }

  const idsToTry = emailIds.filter(Boolean).slice(0, 2)

  for (const id of idsToTry) {
    const endpoint = `https://api.resend.com/emails/receiving/${id}`
    const method = 'GET'
    const response = await fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      let errorBody = ''
      try {
        errorBody = await response.text()
      } catch {
        errorBody = ''
      }
      if (response.status === 404) {
        continue
      }
      throw new Error(`Resend received email fetch failed: ${response.status}`)
    }

    const data = await response.json()
    return {
      html: data?.html || null,
      text: data?.text || null,
      headers: data?.headers || null,
    }
  }

  throw new Error('Resend received email fetch failed: no matching id')
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
    const messageId = emailData?.message_id || null
    const emailId = emailData?.email_id || null
    const rawId = emailData?.id || null
    const dataId = body?.data?.id || null
    const dataEmailId = body?.data?.email_id || null
    const recordId = body?.data?.record?.id || null
    const recordEmailId = body?.data?.record?.email_id || null
    const nestedEmailId = emailData?.email?.id || body?.data?.email?.id || null
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
    let emailHtml: string | null = null
    let emailText: string | null = null
    if (typeof rawEmail === 'string') {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H3',location:'lib/handlers/resend-inbound.ts:109',message:'parseEmail branch raw string',data:{eventType,hasHtml:typeof emailData?.html === 'string',hasText:typeof emailData?.text === 'string'},timestamp:Date.now()})}).catch(()=>{});
      // #endregion agent log
      parsedEmail = await parseEmail(Buffer.from(rawEmail))
    } else if (emailData.html || emailData.text || emailData.text_plain) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H3',location:'lib/handlers/resend-inbound.ts:113',message:'parseEmail branch plain fields',data:{eventType,hasHtml:Boolean(emailData.html || emailData.text_html),hasText:Boolean(emailData.text || emailData.text_plain)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion agent log
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H3',location:'lib/handlers/resend-inbound.ts:128',message:'parseEmail branch fallback empty',data:{eventType},timestamp:Date.now()})}).catch(()=>{});
      // #endregion agent log
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

    const candidateIds = [
      emailId,
      rawId,
      dataId,
      dataEmailId,
      recordId,
      recordEmailId,
      nestedEmailId,
    ].filter((id, index, array) => id && array.indexOf(id) === index) as string[]
    if (candidateIds.length > 0) {
      try {
        const received = await fetchReceivedEmailContent(candidateIds)
        emailHtml = received.html
        emailText = received.text ? stripSubstackTracking(received.text) : received.text
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H5',location:'lib/handlers/resend-inbound.ts:158',message:'received email content',data:{htmlLen:emailHtml?.length ?? 0,textLen:emailText?.length ?? 0,textHasTracking:(emailText || '').includes('eotrx.substackcdn.com/open?token='),htmlHasTracking:(emailHtml || '').includes('eotrx.substackcdn.com/open?token='),hasHtml:Boolean(emailHtml),hasText:Boolean(emailText)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion agent log
      } catch (error) {
        console.error('Failed to fetch received email content:', error)
      }
    } else {
    }

    if (emailHtml || emailText) {
      const extracted = extractEmailContent({ text: emailText, html: emailHtml })
      parsedEmail = {
        ...parsedEmail,
        ...extracted,
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H6',location:'lib/handlers/resend-inbound.ts:170',message:'extracted email content',data:{textLen:parsedEmail.textContent.length,links:parsedEmail.links.length,images:parsedEmail.images.length,trackingFound:(parsedEmail.textContent || '').includes('eotrx.substackcdn.com/open?token=')},timestamp:Date.now()})}).catch(()=>{});
      // #endregion agent log
    }

    const feedItem = emailToFeedItem(parsedEmail, source.publicationName)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H4',location:'lib/handlers/resend-inbound.ts:165',message:'feed item from email',data:{excerptLen:feedItem.excerpt?.length ?? 0,excerptHasTracking:(feedItem.excerpt || '').includes('eotrx.substackcdn.com/open?token='),thumbnailPresent:Boolean(feedItem.thumbnail)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log
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
        emailHtml,
        emailText,
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
        emailHtml,
        emailText,
        url: feedItem.url,
        thumbnail: feedItem.thumbnail,
        rawPayload: feedItem.rawPayload as any,
      },
    })

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
