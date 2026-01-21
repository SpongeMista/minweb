import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getDefaultUserId } from '@/lib/default-user'

/**
 * This route associates Google OAuth accounts with the default user
 * Should be called after OAuth completes (can be triggered from settings page)
 */
export async function POST(request: NextRequest) {
  try {
    const defaultUserId = await getDefaultUserId()
    
    // Find all Google accounts not associated with default user
    const accounts = await prisma.account.findMany({
      where: {
        provider: 'google',
        userId: {
          not: defaultUserId,
        },
      },
    })
    
    for (const account of accounts) {
      // Check if default user already has a Google account
      const existingAccount = await prisma.account.findFirst({
        where: {
          userId: defaultUserId,
          provider: 'google',
        },
      })
      
      if (existingAccount) {
        // Default user already has an account, delete this duplicate
        await prisma.account.delete({
          where: { id: account.id },
        })
      } else {
        // Move this account to default user
        await prisma.account.update({
          where: { id: account.id },
          data: { userId: defaultUserId },
        })
      }
      
      // Delete the old user if it has no other accounts
      const userAccounts = await prisma.account.count({
        where: { userId: account.userId },
      })
      
      if (userAccounts === 0 && account.userId !== defaultUserId) {
        await prisma.user.delete({
          where: { id: account.userId },
        }).catch(() => {
          // Ignore errors
        })
      }
    }
    
    // Ensure YoutubeConnection exists
    await prisma.youtubeConnection.upsert({
      where: { userId: defaultUserId },
      create: {
        userId: defaultUserId,
      },
      update: {},
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to associate accounts:', error)
    return NextResponse.json({ error: 'Failed to associate accounts' }, { status: 500 })
  }
}
