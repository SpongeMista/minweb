import { getFeed } from '@/lib/feed'
import { prisma } from '@/lib/db'

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    feedItem: {
      findMany: jest.fn(),
    },
  },
}))

describe('Feed Pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return items with pagination metadata', async () => {
    const mockItems = [
      {
        id: '1',
        userId: 'user1',
        source: 'substack',
        sourceId: 'post1',
        title: 'Test Post',
        publishedAt: new Date('2024-01-01'),
      },
      {
        id: '2',
        userId: 'user1',
        source: 'youtube',
        sourceId: 'video1',
        title: 'Test Video',
        publishedAt: new Date('2024-01-02'),
      },
    ]

    ;(prisma.feedItem.findMany as jest.Mock).mockResolvedValue(mockItems)

    const result = await getFeed('user1', { limit: 20 })

    expect(result.items).toHaveLength(2)
    expect(result.hasMore).toBe(false)
    expect(result.nextCursor).toBeNull()
  })

  it('should generate next cursor when hasMore is true', async () => {
    const mockItems = Array.from({ length: 21 }, (_, i) => ({
      id: `item-${i}`,
      userId: 'user1',
      source: 'substack',
      sourceId: `post-${i}`,
      title: `Post ${i}`,
      publishedAt: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`),
    }))

    ;(prisma.feedItem.findMany as jest.Mock).mockResolvedValue(mockItems)

    const result = await getFeed('user1', { limit: 20 })

    expect(result.items).toHaveLength(20)
    expect(result.hasMore).toBe(true)
    expect(result.nextCursor).toBeTruthy()
  })

  it('should filter by source', async () => {
    const mockItems = [
      {
        id: '1',
        userId: 'user1',
        source: 'substack',
        sourceId: 'post1',
        title: 'Test Post',
        publishedAt: new Date('2024-01-01'),
      },
    ]

    ;(prisma.feedItem.findMany as jest.Mock).mockResolvedValue(mockItems)

    await getFeed('user1', { source: 'substack', limit: 20 })

    expect(prisma.feedItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user1',
          source: 'substack',
        }),
      })
    )
  })

  it('should exclude YouTube shorts when hideYoutubeShorts is enabled', async () => {
    const mockItems = [
      {
        id: '1',
        userId: 'user1',
        source: 'substack',
        sourceId: 'post1',
        title: 'Test Post',
        publishedAt: new Date('2024-01-01'),
      },
    ]

    ;(prisma.feedItem.findMany as jest.Mock).mockResolvedValue(mockItems)

    await getFeed('user1', { hideYoutubeShorts: true, limit: 20 })

    expect(prisma.feedItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user1',
          NOT: {
            source: 'youtube',
            durationSeconds: {
              lt: 180,
            },
          },
        }),
      })
    )
  })
})

