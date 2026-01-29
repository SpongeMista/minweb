import { FeedItem, FeedItemSchema } from '@/lib/types'
import { BaseConnector } from './base'
import { prisma } from '@/lib/db'

type RedditSort = 'new' | 'hot' | 'top'

export class RedditConnector extends BaseConnector {
  async sync(userId: string): Promise<FeedItem[]> {
    try {
      const subreddits = await prisma.userRedditSubreddit.findMany({
        where: { userId },
        select: { subreddit: true, sort: true },
      })

      if (subreddits.length === 0) {
        return []
      }

      const allItems: FeedItem[] = []
      let successCount = 0
      let errorCount = 0

      for (const subreddit of subreddits) {
        try {
          const sort = this.normalizeSort(subreddit.sort ?? 'new')
          const items = await this.fetchSubredditPosts(subreddit.subreddit, sort, {
            targetCount: 10,
          })
          allItems.push(...items)
          successCount++
        } catch (error: any) {
          errorCount++
          const errorMsg = error?.message || String(error)
          console.error(`Failed to fetch r/${subreddit.subreddit}: ${errorMsg}`)
        }
      }

      if (allItems.length > 0) {
        await this.upsertFeedItems(userId, allItems)
      } else if (errorCount > 0) {
        console.warn(`Warning: No Reddit items fetched. ${errorCount} subreddits failed.`)
      }

      await prisma.redditConnection.upsert({
        where: { userId },
        create: { userId, lastSyncedAt: new Date() },
        update: { lastSyncedAt: new Date() },
      })

      console.log(
        `Fetched ${allItems.length} Reddit items (${successCount} subreddits succeeded, ${errorCount} failed)`
      )

      return allItems
    } catch (error) {
      console.error('Failed to sync Reddit:', error)
      throw error
    }
  }

  private normalizeSort(value?: string | null): RedditSort {
    if (value === 'hot' || value === 'top' || value === 'new') {
      return value
    }
    return 'new'
  }

  async backfill(userId: string, before: Date, cutoff: Date): Promise<FeedItem[]> {
    const subreddits = await prisma.userRedditSubreddit.findMany({
      where: { userId },
      select: { subreddit: true, sort: true },
    })
    if (subreddits.length === 0) return []

    const allItems: FeedItem[] = []
    for (const subreddit of subreddits) {
      const sort = this.normalizeSort(subreddit.sort ?? 'new')
      const items = await this.fetchSubredditPosts(subreddit.subreddit, sort, {
        targetCount: 20,
        before,
        cutoff,
      })
      allItems.push(...items)
    }

    if (allItems.length > 0) {
      await this.upsertFeedItems(userId, allItems)
    }

    return allItems
  }

  private async fetchSubredditPosts(
    subreddit: string,
    sort: RedditSort,
    options: { targetCount: number; before?: Date; cutoff?: Date }
  ): Promise<FeedItem[]> {
    let after: string | null = null
    let pageCount = 0
    const maxPages = 5
    const items: FeedItem[] = []

    while (items.length < options.targetCount && pageCount < maxPages) {
      const url = new URL(`https://www.reddit.com/r/${subreddit}/${sort}.json`)
      url.searchParams.set('limit', '50')
      url.searchParams.set('raw_json', '1')
      if (sort === 'top') {
        url.searchParams.set('t', 'day')
      }
      if (after) {
        url.searchParams.set('after', after)
      }

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': process.env.REDDIT_USER_AGENT || 'feed-app/1.0 (public)',
        },
      })

      if (!response.ok) {
        throw new Error(`Reddit response ${response.status}`)
      }

      const payload = await response.json()
      const children = payload?.data?.children ?? []
      let hitCutoff = false

      for (const child of children) {
        const data = child?.data
        if (!data?.id) continue
        try {
          const publishedAt = data.created_utc
            ? this.normalizeTimestamp(data.created_utc * 1000)
            : new Date()
          if (options.before && publishedAt >= options.before) {
            continue
          }
          if (options.cutoff && publishedAt < options.cutoff) {
            hitCutoff = true
            continue
          }

          const title = this.sanitizeTitle(data.title || '')
          if (!title) continue

          const excerpt = this.extractExcerpt(data.selftext || '')
          const thumbnail = this.extractThumbnail(data)
          const normalizedSubreddit =
            typeof data.subreddit === 'string' ? data.subreddit.toLowerCase() : data.subreddit
          const feedItem: FeedItem = {
            source: 'reddit',
            sourceId: data.id,
            title,
            author: data.author ? `u/${data.author}` : null,
            publishedAt,
            excerpt,
            url: data.permalink ? `https://www.reddit.com${data.permalink}` : data.url,
            thumbnail,
            rawPayload: {
              ...data,
              subreddit: normalizedSubreddit,
            },
          }

          FeedItemSchema.parse(feedItem)
          items.push(feedItem)
          if (items.length >= options.targetCount) break
        } catch (error) {
          console.error('Failed to parse Reddit item:', error)
        }
      }

      after = payload?.data?.after ?? null
      pageCount += 1
      if (!after || hitCutoff) break
    }

    return items.slice(0, options.targetCount)
  }

  private extractExcerpt(text: string): string | null {
    if (!text) return null
    const trimmed = text.trim()
    return trimmed.length > 200 ? `${trimmed.slice(0, 200)}...` : trimmed
  }

  private sanitizeTitle(title: string): string {
    return title.trim().substring(0, 500)
  }

  private extractThumbnail(data: any): string | null {
    const preview = data?.preview?.images?.[0]?.source?.url
    if (typeof preview === 'string' && preview.startsWith('http')) {
      return preview
    }
    const thumbnail = data?.thumbnail
    if (typeof thumbnail === 'string' && thumbnail.startsWith('http')) {
      return thumbnail
    }
    return null
  }
}
