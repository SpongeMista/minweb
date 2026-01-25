import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { google } from 'googleapis'

const QuerySchema = z.object({
  query: z.string().min(1),
})

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing YOUTUBE_API_KEY' }, { status: 500 })
    }

    const parsed = QuerySchema.parse({
      query: request.nextUrl.searchParams.get('query') || '',
    })

    const youtube = google.youtube({ version: 'v3', auth: apiKey })
    const response = await youtube.search.list({
      part: ['snippet'],
      q: parsed.query,
      type: ['channel'],
      maxResults: 10,
    })

    const results =
      response.data.items?.map((item) => ({
        channelId: item.id?.channelId || '',
        channelTitle: item.snippet?.channelTitle || item.snippet?.title || 'Unknown Channel',
        thumbnail:
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url ||
          item.snippet?.thumbnails?.default?.url ||
          null,
      })) || []

    return NextResponse.json({ results: results.filter((item) => item.channelId) })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query parameters', details: error.errors }, { status: 400 })
    }
    console.error('YouTube search API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
