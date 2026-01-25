import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { prisma } from '@/lib/db'
import { getDefaultUserId } from '@/lib/default-user'

async function getYoutubeChannelName(account: {
  id: string
  access_token: string | null
  refresh_token: string | null
  expires_at: number | null
}) {
  if (!account.access_token) {
    return null
  }

  let accessToken = account.access_token
  const expiresAt = account.expires_at ? new Date(account.expires_at * 1000) : null

  if (expiresAt && expiresAt < new Date()) {
    if (!account.refresh_token) {
      return null
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
    )

    oauth2Client.setCredentials({
      refresh_token: account.refresh_token,
    })

    const { credentials } = await oauth2Client.refreshAccessToken()
    accessToken = credentials.access_token || accessToken

    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: credentials.access_token || account.access_token,
        expires_at: credentials.expiry_date
          ? Math.floor(credentials.expiry_date / 1000)
          : account.expires_at,
        refresh_token: credentials.refresh_token || account.refresh_token,
      },
    })
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  )

  oauth2Client.setCredentials({
    access_token: accessToken,
  })

  const youtube = google.youtube({ version: 'v3', auth: oauth2Client })
  const channelResponse = await youtube.channels.list({
    part: ['snippet'],
    mine: true,
    maxResults: 1,
  })

  return channelResponse.data.items?.[0]?.snippet?.title || null
}

export async function GET() {
  try {
    const userId = await getDefaultUserId()

    // Check if user has Google OAuth account
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: 'google',
      },
    })

    const connection = await prisma.youtubeConnection.findUnique({
      where: { userId },
    })

    let channelName: string | null = null
    if (account && account.access_token) {
      try {
        channelName = await getYoutubeChannelName({
          id: account.id,
          access_token: account.access_token,
          refresh_token: account.refresh_token,
          expires_at: account.expires_at ?? null,
        })
      } catch (error) {
        console.error('Failed to fetch YouTube channel name:', error)
      }
    }

    return NextResponse.json({
      connected: !!account && !!account.access_token,
      lastSyncedAt: connection?.lastSyncedAt || null,
      channelName,
    })
  } catch (error) {
    console.error('YouTube status API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

