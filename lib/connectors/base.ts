import { FeedItem, Connector } from '@/lib/types'
import { prisma } from '@/lib/db'

export abstract class BaseConnector implements Connector {
  abstract sync(userId: string): Promise<FeedItem[]>

  protected async upsertFeedItems(userId: string, items: FeedItem[]): Promise<void> {
    // Use idempotency: unique constraint on (userId, source, sourceId) prevents duplicates
    let successCount = 0
    let errorCount = 0
    
    for (const item of items) {
      try {
        await prisma.feedItem.upsert({
          where: {
            userId_source_sourceId: {
              userId,
              source: item.source,
              sourceId: item.sourceId,
            },
          },
          update: {
            title: item.title,
            author: item.author,
            publishedAt: item.publishedAt,
            excerpt: item.excerpt,
            url: item.url,
            thumbnail: item.thumbnail,
            durationSeconds: item.durationSeconds ?? null,
            rawPayload: item.rawPayload as any,
            updatedAt: new Date(),
          },
          create: {
            userId,
            source: item.source,
            sourceId: item.sourceId,
            title: item.title,
            author: item.author,
            publishedAt: item.publishedAt,
            excerpt: item.excerpt,
            url: item.url,
            thumbnail: item.thumbnail,
            durationSeconds: item.durationSeconds ?? null,
            rawPayload: item.rawPayload as any,
          },
        })
        successCount++
      } catch (error: any) {
        errorCount++
        // Log but don't fail entire sync if one item fails
        console.error(`Failed to upsert feed item ${item.sourceId}:`, error.message || error)
        if (error.code) {
          console.error(`  Error code: ${error.code}`)
        }
      }
    }
    
    console.log(`Upserted ${successCount} items, ${errorCount} failed`)
  }

  protected normalizeTimestamp(date: Date | string | number): Date {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
    // Ensure UTC
    return new Date(d.toISOString())
  }
}

