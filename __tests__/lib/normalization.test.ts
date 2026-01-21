import { FeedItemSchema } from '@/lib/types'

describe('FeedItem Normalization', () => {
  it('should validate valid feed item', () => {
    const validItem = {
      source: 'substack' as const,
      sourceId: 'post-123',
      title: 'Test Post',
      author: 'Test Author',
      publishedAt: new Date(),
      excerpt: 'Test excerpt',
      url: 'https://example.com/post',
      thumbnail: 'https://example.com/image.jpg',
    }

    expect(() => FeedItemSchema.parse(validItem)).not.toThrow()
  })

  it('should reject invalid source', () => {
    const invalidItem = {
      source: 'invalid',
      sourceId: 'post-123',
      title: 'Test',
      publishedAt: new Date(),
      url: 'https://example.com',
    }

    expect(() => FeedItemSchema.parse(invalidItem)).toThrow()
  })

  it('should reject invalid URL', () => {
    const invalidItem = {
      source: 'substack' as const,
      sourceId: 'post-123',
      title: 'Test',
      publishedAt: new Date(),
      url: 'not-a-url',
    }

    expect(() => FeedItemSchema.parse(invalidItem)).toThrow()
  })

  it('should allow null author and excerpt', () => {
    const item = {
      source: 'youtube' as const,
      sourceId: 'video-123',
      title: 'Test Video',
      author: null,
      publishedAt: new Date(),
      excerpt: null,
      url: 'https://youtube.com/watch?v=123',
      thumbnail: null,
    }

    expect(() => FeedItemSchema.parse(item)).not.toThrow()
  })

  it('should require sourceId', () => {
    const invalidItem = {
      source: 'substack' as const,
      sourceId: '',
      title: 'Test',
      publishedAt: new Date(),
      url: 'https://example.com',
    }

    expect(() => FeedItemSchema.parse(invalidItem)).toThrow()
  })
})

