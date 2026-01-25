import { google } from 'googleapis'
import { FeedItem, FeedItemSchema } from '@/lib/types'
import { BaseConnector } from './base'
import { prisma } from '@/lib/db'

export class YouTubeConnector extends BaseConnector {
  private getPublicClient() {
    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) {
      throw new Error('Missing YOUTUBE_API_KEY')
    }
    return google.youtube({ version: 'v3', auth: apiKey })
  }

  async sync(userId: string): Promise<FeedItem[]> {
    try {
      const youtube = this.getPublicClient()
      const channels = await prisma.userYoutubeChannel.findMany({
        where: { userId },
        select: { channelId: true },
      })

      if (channels.length === 0) {
        return []
      }

      const channelsToProcess = channels.map((channel) => channel.channelId)
      console.log(`Processing ${channelsToProcess.length} channels`)
      
      // Get recent uploads from subscribed channels
      const allItems: FeedItem[] = []
      let successCount = 0
      let errorCount = 0
      
      for (const channelId of channelsToProcess) {
        try {
          const items = await this.getChannelUploads(youtube, channelId)
          allItems.push(...items)
          successCount++
          if (items.length > 0) {
            console.log(`  ✓ Channel ${channelId}: ${items.length} items`)
          }
        } catch (error: any) {
          errorCount++
          const errorMsg = error.message || String(error)
          console.error(`  ✗ Failed to fetch uploads for channel ${channelId}: ${errorMsg}`)
          // Continue with other channels - don't fail entire sync
        }
      }
      
      console.log(`Fetched ${allItems.length} total YouTube items (${successCount} channels succeeded, ${errorCount} failed)`)

      // Only upsert if we have items - don't fail if we got some items from some channels
      if (allItems.length > 0) {
        console.log(`Attempting to save ${allItems.length} items for userId: ${userId}`)
        await this.upsertFeedItems(userId, allItems)
        
        // Verify items were saved by querying the database
        const savedCount = await prisma.feedItem.count({
          where: {
            userId,
            source: 'youtube',
          },
        })
        console.log(`Verified: ${savedCount} YouTube items exist in database for userId: ${userId}`)
      } else if (errorCount > 0) {
        // If we got errors but no items, log a warning but don't throw
        console.warn(`Warning: No items were fetched. ${errorCount} channels failed.`)
      }

      // Update lastSyncedAt in YoutubeConnection (if exists) or create it
      await prisma.youtubeConnection.upsert({
        where: { userId },
        create: {
          userId,
          lastSyncedAt: new Date(),
        },
        update: {
          lastSyncedAt: new Date(),
        },
      })

      return allItems
    } catch (error) {
      console.error('Failed to sync YouTube:', error)
      throw error
    }
  }

  private async getChannelUploads(youtube: any, channelId: string): Promise<FeedItem[]> {
    try {
      // Combine both channel API calls into one to reduce API quota usage
      const channelResponse = await youtube.channels.list({
        part: ['contentDetails', 'snippet'], // Get both in one call
        id: [channelId],
      })

      if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
        console.log(`  Channel ${channelId} not found`)
        return []
      }

      const channel = channelResponse.data.items[0]
      const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads

      if (!uploadsPlaylistId) {
        console.log(`  Channel ${channelId} has no uploads playlist`)
        return []
      }

      const channelName = channel.snippet?.title || 'Unknown Channel'

      // Get recent videos from uploads playlist
      // Limit to 5 videos per channel to reduce API calls and quota usage
      const playlistResponse = await youtube.playlistItems.list({
        part: ['snippet', 'contentDetails'],
        playlistId: uploadsPlaylistId,
        maxResults: 5, // Reduced to 5 per channel
      })

      if (!playlistResponse.data || !playlistResponse.data.items) {
        return []
      }

      const items: FeedItem[] = []
      const videoIds: string[] = []

      for (const item of playlistResponse.data.items) {
      try {
        const videoId = item.contentDetails?.videoId
        if (!videoId) continue
        videoIds.push(videoId)

        const snippet = item.snippet
        const title = snippet?.title || 'Untitled'
        const publishedAt = snippet?.publishedAt
          ? this.normalizeTimestamp(snippet.publishedAt)
          : new Date()
        const thumbnail =
          snippet?.thumbnails?.high?.url ||
          snippet?.thumbnails?.medium?.url ||
          snippet?.thumbnails?.default?.url ||
          null
        const description = snippet?.description || ''

        const feedItem: FeedItem = {
          source: 'youtube',
          sourceId: videoId,
          title: this.sanitizeTitle(title),
          author: channelName,
          publishedAt,
          excerpt: this.extractExcerpt(description),
          url: `https://www.youtube.com/watch?v=${videoId}`,
          thumbnail,
          durationSeconds: null,
          rawPayload: item,
        }

        FeedItemSchema.parse(feedItem)
        items.push(feedItem)
      } catch (error) {
        console.error('Failed to parse YouTube item:', error)
        // Skip invalid items
      }
    }

      if (videoIds.length > 0) {
        const durations = await this.getVideoDurations(youtube, videoIds)
        for (const feedItem of items) {
          const duration = durations.get(feedItem.sourceId)
          if (duration !== undefined) {
            feedItem.durationSeconds = duration
          }
        }
      }

      return items
    } catch (error: any) {
      // Log detailed error information
      const errorCode = error.code || error.response?.status
      const errorMessage = error.message || 'Unknown error'
      const errorDetails = error.response?.data
      
      console.error(`Error fetching uploads for channel ${channelId}:`)
      console.error(`  Error code: ${errorCode}`)
      console.error(`  Error message: ${errorMessage}`)
      
      if (errorDetails) {
        console.error(`  API error:`, JSON.stringify(errorDetails, null, 2))
        
        // Check for common YouTube API errors
        if (errorDetails.error?.errors) {
          errorDetails.error.errors.forEach((err: any) => {
            console.error(`    - ${err.domain}: ${err.reason} - ${err.message}`)
          })
        }
      }
      
      // Return empty array instead of throwing - allows other channels to continue
      // Only throw if it's a critical authentication error
      if (errorCode === 401 || errorCode === 403) {
        throw new Error(`YouTube API authentication error: ${errorMessage}`)
      }
      
      // For other errors, just return empty array and continue with other channels
      return []
    }
  }

  private extractExcerpt(description: string): string | null {
    if (!description) return null
    const text = description.trim()
    return text.length > 200 ? text.substring(0, 200) + '...' : text
  }

  private sanitizeTitle(title: string): string {
    return title.trim().substring(0, 500)
  }

  private async getVideoDurations(youtube: any, videoIds: string[]): Promise<Map<string, number>> {
    const durations = new Map<string, number>()

    const response = await youtube.videos.list({
      part: ['contentDetails'],
      id: videoIds,
      maxResults: 50,
    })

    for (const item of response.data.items || []) {
      const id = item.id
      const durationIso = item.contentDetails?.duration
      if (id && durationIso) {
        const seconds = this.parseIsoDuration(durationIso)
        if (seconds !== null) {
          durations.set(id, seconds)
        }
      }
    }

    return durations
  }

  private parseIsoDuration(duration: string): number | null {
    const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
    if (!match) return null

    const hours = Number(match[1] || 0)
    const minutes = Number(match[2] || 0)
    const seconds = Number(match[3] || 0)
    return hours * 3600 + minutes * 60 + seconds
  }
}

