import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const QuerySchema = z.object({
  query: z.string().min(1),
})

export async function GET(request: NextRequest) {
  try {
    const parsed = QuerySchema.parse({
      query: request.nextUrl.searchParams.get('query') || '',
    })

    const searchParams = new URLSearchParams({
      q: parsed.query,
      limit: '10',
      raw_json: '1',
    })
    const userAgent =
      process.env.REDDIT_USER_AGENT ||
      'Mozilla/5.0 (compatible; feed-app/1.0; +https://example.com)'
    const baseUrls = ['https://www.reddit.com', 'https://old.reddit.com']
    let response: Response | null = null
    let lastStatus: number | null = null
    for (const baseUrl of baseUrls) {
      const url = new URL('/subreddits/search.json', baseUrl)
      url.search = searchParams.toString()
      response = await fetch(url.toString(), {
        headers: {
          'User-Agent': userAgent,
          Accept: 'application/json',
        },
      })
      if (response.ok) {
        break
      }
      lastStatus = response.status
      if (response.status !== 403 && response.status !== 429) {
        break
      }
    }

    if (!response || !response.ok) {
      return NextResponse.json(
        { error: 'Reddit search failed' },
        { status: lastStatus ?? response?.status ?? 500 }
      )
    }

    let payload: any = null
    try {
      payload = await response.json()
    } catch (error) {
      throw error
    }
    const results =
      payload?.data?.children?.map((child: any) => {
        const data = child?.data
        const icon =
          data?.icon_img ||
          (typeof data?.community_icon === 'string' ? data.community_icon.split('?')[0] : null)
        return {
          subreddit: data?.display_name || '',
          title: data?.title || data?.display_name || 'Unknown Subreddit',
          icon: icon || null,
        }
      }) || []

    const filteredResults = results.filter((item: any) => item.subreddit)
    return NextResponse.json({ results: filteredResults })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query parameters', details: error.errors }, { status: 400 })
    }
    console.error('Reddit search API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
