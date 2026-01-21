import Parser from 'rss-parser'
import { FeedItem, FeedItemSchema } from '@/lib/types'
import { BaseConnector } from './base'
import { prisma } from '@/lib/db'

const parser = new Parser({
  timeout: 10000,
  customFields: {
    item: ['content:encoded', 'media:thumbnail', 'enclosure'],
  },
})

export class SubstackConnector extends BaseConnector {
  async sync(userId: string): Promise<FeedItem[]> {
    const sources = await prisma.substackSource.findMany({
      where: { userId },
    })

    if (sources.length === 0) {
      return []
    }

    const allItems: FeedItem[] = []

    for (const source of sources) {
      try {
        // If source has RSS URL, sync via RSS (backwards compatibility)
        if (source.rssUrl) {
          const items = await this.fetchFeedItems(source.rssUrl, source.publicationName)
          allItems.push(...items)
        }
        
        // Note: Email-based sources are synced via webhook, not here
        // We only sync RSS-based sources in this method

        // Update lastSyncedAt
        await prisma.substackSource.update({
          where: { id: source.id },
          data: { lastSyncedAt: new Date() },
        })
      } catch (error) {
        console.error(`Failed to sync Substack source ${source.id}:`, error)
        // Continue with other sources
      }
    }

    // Upsert all items
    await this.upsertFeedItems(userId, allItems)

    return allItems
  }

  private async fetchFeedItems(rssUrl: string, publicationName: string): Promise<FeedItem[]> {
    try {
      const feed = await parser.parseURL(rssUrl)
      const items: FeedItem[] = []

      for (const item of feed.items || []) {
        try {
          // Generate sourceId from URL (hash or use URL itself)
          const sourceId = this.generateSourceId(item.link || item.guid || '')

          // Extract title
          const title = item.title || 'Untitled'

          // Extract author (try multiple fields)
          const author = item.creator || (item as any)['dc:creator'] || publicationName || null

          // Extract published date
          const publishedAt = item.pubDate
            ? this.normalizeTimestamp(item.pubDate)
            : new Date()

          // Extract excerpt/description
          const excerpt = this.extractExcerpt(
            item.contentSnippet || item.content || (item as any).description || ''
          )

          // Extract URL
          const url = item.link || item.guid || ''

          // Extract thumbnail
          const thumbnail = this.extractThumbnail(item)

          // Validate and create feed item
          const feedItem: FeedItem = {
            source: 'substack',
            sourceId,
            title: this.sanitizeTitle(title),
            author: author ? this.sanitizeAuthor(author) : null,
            publishedAt,
            excerpt: excerpt || null,
            url: this.sanitizeUrl(url),
            thumbnail: thumbnail || null,
            rawPayload: item,
          }

          // Validate with Zod
          FeedItemSchema.parse(feedItem)
          items.push(feedItem)
        } catch (error) {
          console.error('Failed to parse RSS item:', error)
          // Skip invalid items but continue processing
        }
      }

      return items
    } catch (error) {
      console.error(`Failed to fetch RSS feed ${rssUrl}:`, error)
      throw error
    }
  }

  private generateSourceId(url: string): string {
    // Use URL as sourceId, but normalize it
    // In production, you might want to hash it for consistency
    return url || `substack-${Date.now()}-${Math.random()}`
  }

  private extractExcerpt(content: string): string | null {
    if (!content) return null

    // Remove HTML tags and get first 200 chars
    const text = content.replace(/<[^>]*>/g, '').trim()
    if (text.length === 0) return null

    // Limit to 200 characters
    return text.length > 200 ? text.substring(0, 200) + '...' : text
  }

  private extractThumbnail(item: any): string | null {
    // Try multiple sources for thumbnail
    if (item['media:thumbnail']?.['$']?.url) {
      return item['media:thumbnail']['$'].url
    }
    if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) {
      return item.enclosure.url
    }
    const content = item.content || (item as any)['content:encoded'] || ''
    if (content) {
      // Try to extract img src from content
      const imgMatch = content.match(/<img[^>]+src="([^"]+)"/i)
      if (imgMatch) {
        return imgMatch[1]
      }
    }
    return null
  }

  private sanitizeTitle(title: string): string {
    return title.trim().substring(0, 500) // Reasonable limit
  }

  private sanitizeAuthor(author: string): string {
    return author.trim().substring(0, 200)
  }

  private sanitizeUrl(url: string): string {
    // Basic URL validation
    try {
      new URL(url)
      return url
    } catch {
      // If invalid, return empty string (will fail validation)
      return ''
    }
  }
}

