import { NextResponse } from 'next/server'
import { getDefaultUserId } from '@/lib/default-user'

export async function GET() {
  try {
    const domain = process.env.RESEND_DOMAIN
    if (!domain) {
      return NextResponse.json(
        { error: 'RESEND_DOMAIN is not configured' },
        { status: 503 }
      )
    }

    const userId = await getDefaultUserId()
    const email = `substack-${userId}@${domain}`

    const existing = await prisma.substackSource.findUnique({
      where: { subscriptionEmail: email },
    })

    if (!existing) {
      await prisma.substackSource.create({
        data: {
          userId,
          publicationName: 'Email Newsletters',
          subscriptionEmail: email,
          emailProvider: process.env.EMAIL_PROVIDER || 'resend',
        },
      })
    }

    return NextResponse.json({ email })
  } catch (error) {
    console.error('Substack email API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
