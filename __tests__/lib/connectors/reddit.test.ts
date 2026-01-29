import { RedditConnector } from '@/lib/connectors/reddit'

describe('RedditConnector', () => {
  describe('normalization', () => {
    it('should truncate long titles', () => {
      const connector = new RedditConnector()
      const longTitle = 'a'.repeat(600)
      const sanitized = connector['sanitizeTitle'](longTitle)
      expect(sanitized.length).toBeLessThanOrEqual(500)
    })

    it('should return null excerpt for empty text', () => {
      const connector = new RedditConnector()
      const excerpt = connector['extractExcerpt']('')
      expect(excerpt).toBeNull()
    })

    it('should truncate long excerpts', () => {
      const connector = new RedditConnector()
      const longText = 'a'.repeat(300)
      const excerpt = connector['extractExcerpt'](longText)
      expect(excerpt?.length).toBeLessThanOrEqual(203)
      expect(excerpt).toContain('...')
    })

    it('should prefer preview image for thumbnails', () => {
      const connector = new RedditConnector()
      const payload = {
        preview: {
          images: [
            {
              source: { url: 'https://example.com/preview.jpg' },
            },
          ],
        },
        thumbnail: 'https://example.com/thumb.jpg',
      }
      const thumbnail = connector['extractThumbnail'](payload)
      expect(thumbnail).toBe('https://example.com/preview.jpg')
    })
  })

  describe('sort normalization', () => {
    it('should default to new for invalid values', () => {
      const connector = new RedditConnector()
      const sort = connector['normalizeSort']('invalid')
      expect(sort).toBe('new')
    })

    it('should allow hot and top', () => {
      const connector = new RedditConnector()
      expect(connector['normalizeSort']('hot')).toBe('hot')
      expect(connector['normalizeSort']('top')).toBe('top')
    })
  })
})
