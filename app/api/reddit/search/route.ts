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

    const url = new URL('https://www.reddit.com/subreddits/search.json')
    url.searchParams.set('q', parsed.query)
    url.searchParams.set('limit', '10')
    url.searchParams.set('raw_json', '1')

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': process.env.REDDIT_USER_AGENT || 'feed-app/1.0 (public)',
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Reddit search failed' }, { status: response.status })
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
