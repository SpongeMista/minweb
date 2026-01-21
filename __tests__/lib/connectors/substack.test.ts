import { SubstackConnector } from '@/lib/connectors/substack'
import { FeedItemSchema } from '@/lib/types'

describe('SubstackConnector', () => {
  describe('normalization', () => {
    it('should normalize timestamps to UTC', () => {
      const connector = new SubstackConnector()
      const date = new Date('2024-01-01T12:00:00-05:00')
      const normalized = connector['normalizeTimestamp'](date)
      
      expect(normalized.toISOString()).toMatch(/2024-01-01T/)
    })

    it('should extract excerpt from HTML content', () => {
      const connector = new SubstackConnector()
      const html = '<p>This is a test excerpt that should be extracted properly.</p>'
      const excerpt = connector['extractExcerpt'](html)
      
      expect(excerpt).toBe('This is a test excerpt that should be extracted properly.')
      expect(excerpt).not.toContain('<p>')
    })

    it('should truncate long excerpts', () => {
      const connector = new SubstackConnector()
      const longText = 'a'.repeat(300)
      const excerpt = connector['extractExcerpt'](longText)
      
      expect(excerpt?.length).toBeLessThanOrEqual(203) // 200 + '...'
      expect(excerpt).toContain('...')
    })

    it('should sanitize titles', () => {
      const connector = new SubstackConnector()
      const longTitle = 'a'.repeat(600)
      const sanitized = connector['sanitizeTitle'](longTitle)
      
      expect(sanitized.length).toBeLessThanOrEqual(500)
    })

    it('should validate URLs', () => {
      const connector = new SubstackConnector()
      const validUrl = 'https://example.com/post'
      const invalidUrl = 'not-a-url'
      
      expect(connector['sanitizeUrl'](validUrl)).toBe(validUrl)
      expect(connector['sanitizeUrl'](invalidUrl)).toBe('')
    })
  })

  describe('RSS parsing edge cases', () => {
    it('should handle missing fields gracefully', () => {
      const connector = new SubstackConnector()
      
      // Test with minimal item
      const minimalItem = {
        link: 'https://example.com/post',
        title: 'Test',
      }
      
      const sourceId = connector['generateSourceId'](minimalItem.link || '')
      expect(sourceId).toBeTruthy()
    })

    it('should handle empty content', () => {
      const connector = new SubstackConnector()
      const excerpt = connector['extractExcerpt']('')
      expect(excerpt).toBeNull()
    })

    it('should handle null/undefined values', () => {
      const connector = new SubstackConnector()
      const excerpt = connector['extractExcerpt'](null as any)
      expect(excerpt).toBeNull()
    })
  })
})

