import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getDefaultUserId } from '@/lib/default-user'
import { getEmailService } from '@/lib/services/email-service'
import { z } from 'zod'

const CreateSchema = z.object({
  rssUrl: z.string().url().optional(),
  publicationName: z.string().min(1).max(200),
  useEmail: z.boolean().optional(), // Whether to use email subscription instead of RSS
})

const UpdateSchema = z.object({
  id: z.string(),
  publicationName: z.string().min(1).max(200).optional(),
})

const DeleteSchema = z.object({
  id: z.string(),
})

export async function GET() {
  try {
    const userId = await getDefaultUserId()

    const sources = await prisma.substackSource.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ sources })
  } catch (error) {
    console.error('Substack API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getDefaultUserId()

    const body = await request.json()
    const { rssUrl, publicationName, useEmail } = CreateSchema.parse(body)

    // Validate that either rssUrl or useEmail is provided
    if (!rssUrl && !useEmail) {
      return NextResponse.json(
        { error: 'Either rssUrl or useEmail must be provided' },
        { status: 400 }
      )
    }

    let subscriptionEmail: string | null = null
    let emailProvider: string | null = null
    let emailProviderId: string | null = null

    // If using email subscription, generate an email address
    if (useEmail) {
      const emailService = getEmailService()
      if (!emailService) {
        return NextResponse.json(
          { error: 'Email service not configured. Please set RESEND_API_KEY and RESEND_DOMAIN.' },
          { status: 503 }
        )
      }

      try {
        subscriptionEmail = await emailService.generateEmailAddress(publicationName)
        emailProvider = process.env.EMAIL_PROVIDER || 'resend'
        // Store provider-specific ID if needed (for future reference)
        emailProviderId = null
      } catch (error) {
        console.error('Failed to generate email address:', error)
        return NextResponse.json(
          { error: 'Failed to generate email address' },
          { status: 500 }
        )
      }
    }

    const source = await prisma.substackSource.create({
      data: {
        userId,
        rssUrl: rssUrl || null,
        publicationName,
        subscriptionEmail,
        emailProvider,
        emailProviderId,
      },
    })

    return NextResponse.json({ source })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.errors }, { status: 400 })
    }
    // Handle unique constraint violation
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'This subscription is already added' }, { status: 409 })
    }
    console.error('Substack API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await getDefaultUserId()

    const body = await request.json()
    const { id, publicationName } = UpdateSchema.parse(body)

    // Verify ownership
    const existing = await prisma.substackSource.findFirst({
      where: { id, userId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const source = await prisma.substackSource.update({
      where: { id },
      data: {
        ...(publicationName && { publicationName }),
      },
    })

    return NextResponse.json({ source })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.errors }, { status: 400 })
    }
    console.error('Substack API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getDefaultUserId()

    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 })
    }

    // Verify ownership
    const existing = await prisma.substackSource.findFirst({
      where: { id, userId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // If using email subscription, delete the email address
    if (existing.subscriptionEmail) {
      const emailService = getEmailService()
      if (emailService) {
        try {
          await emailService.deleteEmailAddress(existing.subscriptionEmail)
        } catch (error) {
          console.error('Failed to delete email address:', error)
          // Continue with deletion even if email deletion fails
        }
      }
    }

    await prisma.substackSource.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Substack API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

