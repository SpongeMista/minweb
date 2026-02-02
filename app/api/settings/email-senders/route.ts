import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getDefaultUserId } from '@/lib/default-user'

const UpdateSchema = z.object({
  email: z.string().email(),
  status: z.enum(['allowed', 'blocked']),
})

export async function GET() {
  try {
    const userId = await getDefaultUserId()
    const senders = await prisma.emailSender.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json({
      allowed: senders.filter((sender) => sender.status === 'allowed'),
      blocked: senders.filter((sender) => sender.status === 'blocked'),
    })
  } catch (error) {
    console.error('Email senders API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getDefaultUserId()
    const body = await request.json()
    const { email, status } = UpdateSchema.parse(body)
    const normalizedEmail = email.trim().toLowerCase()

    const sender = await prisma.emailSender.upsert({
      where: { userId_email: { userId, email: normalizedEmail } },
      create: {
        userId,
        email: normalizedEmail,
        status,
      },
      update: { status },
    })

    return NextResponse.json({ sender })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.errors }, { status: 400 })
    }
    console.error('Email senders API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
