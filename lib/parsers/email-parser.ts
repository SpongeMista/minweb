import { simpleParser } from 'mailparser'
import { parse as parseHtml } from 'node-html-parser'
import { FeedItem } from '@/lib/types'

export interface ParsedEmail {
  subject: string
  from: string
  fromName?: string
  date: Date
  textContent: string
  htmlContent?: string
  links: string[]
  images: string[]
}

/**
 * Parse email content and extract relevant information
 */
export async function parseEmail(rawEmail: Buffer | string): Promise<ParsedEmail> {
  const parsed = await simpleParser(rawEmail)

  // Extract links and images from HTML
  const links: string[] = []
  const images: string[] = []

  if (parsed.html) {
    const root = parseHtml(parsed.html)
    
    // Extract all links
    const linkElements = root.querySelectorAll('a')
    linkElements.forEach((link) => {
      const href = link.getAttribute('href')
      if (href && !links.includes(href)) {
        links.push(href)
      }
    })

    // Extract all images
    const imgElements = root.querySelectorAll('img')
    imgElements.forEach((img) => {
      const src = img.getAttribute('src')
      if (src && !images.includes(src)) {
        images.push(src)
      }
    })
  }

  // Get text content (prefer plain text, fallback to HTML stripped)
  const textContent = parsed.text || stripHtml(parsed.html || '')

  return {
    subject: parsed.subject || 'No Subject',
    from: parsed.from?.value[0]?.address || '',
    fromName: parsed.from?.value[0]?.name,
    date: parsed.date || new Date(),
    textContent,
    htmlContent: parsed.html || undefined,
    links,
    images,
  }
}

/**
 * Convert parsed email to FeedItem format
 */
export function emailToFeedItem(
  parsedEmail: ParsedEmail,
  publicationName: string
): FeedItem {
  // Generate sourceId from email subject and date (for uniqueness)
  const sourceId = `email-${parsedEmail.date.getTime()}-${hashString(parsedEmail.subject)}`

  // Extract excerpt from text content (first 200 chars)
  const excerpt = parsedEmail.textContent
    ? parsedEmail.textContent.substring(0, 200) + (parsedEmail.textContent.length > 200 ? '...' : '')
    : null

  // Get first image as thumbnail, or first link as URL
  const thumbnail = parsedEmail.images[0] || null
  const url = parsedEmail.links.find((link) => 
    link.startsWith('http') && !link.includes('unsubscribe')
  ) || parsedEmail.links[0] || '#'

  return {
    source: 'substack',
    sourceId,
    title: parsedEmail.subject,
    author: parsedEmail.fromName || parsedEmail.from || publicationName,
    publishedAt: parsedEmail.date,
    excerpt,
    url,
    thumbnail,
    rawPayload: parsedEmail,
  }
}

/**
 * Strip HTML tags from string
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

/**
 * Simple hash function for creating unique IDs
 */
function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36)
}
