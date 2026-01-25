import { z } from 'zod'

// Normalized feed item structure
export interface FeedItem {
  source: 'substack' | 'youtube'
  sourceId: string // Unique ID from source
  title: string
  author: string | null
  publishedAt: Date
  excerpt: string | null
  emailHtml?: string | null
  emailText?: string | null
  url: string
  thumbnail: string | null
  durationSeconds?: number | null
  rawPayload?: unknown // Store raw data for debugging
}

// Validation schemas
export const FeedItemSchema = z.object({
  source: z.enum(['substack', 'youtube']),
  sourceId: z.string().min(1),
  title: z.string().min(1),
  author: z.string().nullable(),
  publishedAt: z.date(),
  excerpt: z.string().nullable(),
  emailHtml: z.string().nullable().optional(),
  emailText: z.string().nullable().optional(),
  url: z.string().url(),
  thumbnail: z.string().url().nullable(),
  durationSeconds: z.number().int().min(0).nullable().optional(),
  rawPayload: z.unknown().optional(),
})

// Connector interface
export interface Connector {
  sync(userId: string): Promise<FeedItem[]>
}

// Pagination
export interface PaginationParams {
  cursor?: string
  limit?: number
  source?: 'substack' | 'youtube'
  hideYoutubeShorts?: boolean
  shortsMinSeconds?: number
  youtubeChannelIds?: string[]
}

export interface PaginatedResponse<T> {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}

