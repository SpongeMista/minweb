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

export function extractEmailContent(payload: {
  text?: string | null
  html?: string | null
}): Pick<ParsedEmail, 'textContent' | 'htmlContent' | 'links' | 'images'> {
  const links: string[] = []
  const images: string[] = []

  if (payload.html) {
    const root = parseHtml(payload.html)
    const linkElements = root.querySelectorAll('a')
    linkElements.forEach((link) => {
      const href = link.getAttribute('href')
      if (href && !links.includes(href) && !isSubstackTrackingLink(href)) {
        links.push(href)
      }
    })

    const imgElements = root.querySelectorAll('img')
    let srcCount = 0
    let dataSrcCount = 0
    let srcsetCount = 0
    let dataSrcsetCount = 0
    let lazySrcCount = 0
    let originalSrcCount = 0
    let firstSrc: string | null = null
    let firstDataSrc: string | null = null
    let firstSrcset: string | null = null
    let firstDataSrcset: string | null = null
    let firstLazySrc: string | null = null
    let firstOriginalSrc: string | null = null
    const safeHost = (value?: string | null) => {
      if (!value) return null
      try {
        return new URL(value).host
      } catch {
        return null
      }
    }
    const firstFromSrcset = (value?: string | null) => {
      if (!value) return null
      const first = value.split(',')[0]?.trim()
      if (!first) return null
      return first.split(/\s+/)[0] || null
    }
    const parseSrcset = (value?: string | null) => {
      if (!value) return []
      return value
        .split(',')
        .map((entry) => entry.trim())
        .map((entry) => {
          const [url, descriptor] = entry.split(/\s+/)
          const width = descriptor?.endsWith('w')
            ? Number(descriptor.replace('w', ''))
            : null
          return { url, width: Number.isFinite(width) ? width : null }
        })
        .filter((entry) => entry.url)
    }
    const decodeEncodedUrl = (value?: string | null) => {
      if (!value) return null
      const encodedMatch = value.match(/https%3A%2F%2F[^'")\s]+/i)
      if (!encodedMatch) return null
      try {
        return decodeURIComponent(encodedMatch[0])
      } catch {
        return null
      }
    }
    const ensureFetchUrl = (value?: string | null) => {
      if (!value) return null
      if (/^https?:\/\//i.test(value)) return value
      return `https://substackcdn.com/image/fetch/${value.replace(/^\/+/, '')}`
    }
    let firstSrcsetMaxWidth: number | null = null
    let firstSrcsetMaxHost: string | null = null
    let firstSrcsetMaxUrl: string | null = null
    let firstSrcsetWidths: number[] = []
    imgElements.forEach((img) => {
      const src = img.getAttribute('src')
      const dataSrc = img.getAttribute('data-src')
      const srcset = img.getAttribute('srcset')
      const dataSrcset = img.getAttribute('data-srcset')
      const lazySrc = img.getAttribute('data-lazy-src')
      const originalSrc = img.getAttribute('data-original')
      if (src) {
        srcCount += 1
        if (!firstSrc) firstSrc = src
        if (!images.includes(src) && !isSubstackTrackingImage(src)) {
          images.push(src)
        }
      }
      if (dataSrc) {
        dataSrcCount += 1
        if (!firstDataSrc) firstDataSrc = dataSrc
      }
      if (srcset) {
        srcsetCount += 1
        if (!firstSrcset) firstSrcset = firstFromSrcset(srcset)
        if (firstSrcsetMaxWidth === null) {
          const parsed = parseSrcset(srcset)
          firstSrcsetWidths = parsed
            .map((entry) => entry.width)
            .filter((width): width is number => typeof width === 'number')
          const maxEntry = parsed.reduce<{ url: string; width: number | null } | null>(
            (currentMax, entry) => {
              if (!entry.width) return currentMax
              if (!currentMax || (currentMax.width ?? 0) < entry.width) return entry
              return currentMax
            },
            null
          )
          if (maxEntry?.width) {
            firstSrcsetMaxWidth = maxEntry.width
            firstSrcsetMaxHost = safeHost(maxEntry.url)
            firstSrcsetMaxUrl = maxEntry.url
          }
        }
        const parsed = parseSrcset(srcset)
        parsed.forEach((entry) => {
          const decoded = decodeEncodedUrl(entry.url)
          if (decoded && !images.includes(decoded) && !isSubstackTrackingImage(decoded)) {
            images.push(decoded)
          }
          const fetchUrl = ensureFetchUrl(entry.url)
          if (fetchUrl && !images.includes(fetchUrl) && !isSubstackTrackingImage(fetchUrl)) {
            images.push(fetchUrl)
          }
        })
      }
      if (dataSrcset) {
        dataSrcsetCount += 1
        if (!firstDataSrcset) firstDataSrcset = firstFromSrcset(dataSrcset)
      }
      if (lazySrc) {
        lazySrcCount += 1
        if (!firstLazySrc) firstLazySrc = lazySrc
      }
      if (originalSrc) {
        originalSrcCount += 1
        if (!firstOriginalSrc) firstOriginalSrc = originalSrc
      }
    })
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H12',location:'lib/parsers/email-parser.ts:33',message:'extractEmailContent img attributes',data:{imgCount:imgElements.length,srcCount,dataSrcCount,srcsetCount,dataSrcsetCount,lazySrcCount,originalSrcCount,firstSrcHost:safeHost(firstSrc),firstDataSrcHost:safeHost(firstDataSrc),firstSrcsetHost:safeHost(firstSrcset),firstDataSrcsetHost:safeHost(firstDataSrcset),firstLazySrcHost:safeHost(firstLazySrc),firstOriginalSrcHost:safeHost(firstOriginalSrc),firstSrcsetMaxWidth,firstSrcsetMaxHost,firstSrcsetMaxUrl: firstSrcsetMaxUrl ? firstSrcsetMaxUrl.slice(0, 200) : null,firstSrcsetWidths:firstSrcsetWidths.slice(0,6),imagesCaptured:images.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log
  }

  const textContent = payload.text || stripHtml(payload.html || '')
  const cleanedTextContent = stripSubstackTracking(textContent)
  const htmlImageFetchMatches = payload.html
    ? Array.from(payload.html.matchAll(/https?:\/\/[^"' )]+substackcdn\.com\/image\/fetch[^"' )]*/gi)).map(
        (match) => match[0]
      )
    : []
  const htmlImageFetchFirst = htmlImageFetchMatches[0] || null
  const htmlImageFetchHosts = htmlImageFetchFirst ? safeUrlHost(htmlImageFetchFirst) : null
  const textImageFetchMatches = payload.text
    ? Array.from(payload.text.matchAll(/https?:\/\/[^"' )]+substackcdn\.com\/image\/fetch[^"' )]*/gi)).map(
        (match) => match[0]
      )
    : []
  const imageFetchMatches = [...htmlImageFetchMatches, ...textImageFetchMatches]
  imageFetchMatches.forEach((match) => {
    if (!images.includes(match) && !isSubstackTrackingImage(match)) {
      images.push(match)
    }
  })
  const textImageFetchFirst = textImageFetchMatches[0] || null
  const textImageFetchHost = textImageFetchFirst ? safeUrlHost(textImageFetchFirst) : null
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H13',location:'lib/parsers/email-parser.ts:46',message:'extractEmailContent image fetch matches',data:{hasHtml:Boolean(payload.html),htmlImageFetchCount:htmlImageFetchMatches.length,htmlImageFetchHost:htmlImageFetchHosts,hasText:Boolean(payload.text),textImageFetchCount:textImageFetchMatches.length,textImageFetchHost:textImageFetchHost},timestamp:Date.now()})}).catch(()=>{});
  // #endregion agent log
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H5',location:'lib/parsers/email-parser.ts:22',message:'extractEmailContent cleaned text/links/images',data:{hasHtml:Boolean(payload.html),textLen:textContent.length,cleanedLen:cleanedTextContent.length,trackingFound:hasSubstackTracking(textContent),links:links.length,images:images.length},timestamp:Date.now()})}).catch(()=>{});
  // #endregion agent log

  return {
    textContent: cleanedTextContent,
    htmlContent: payload.html || undefined,
    links,
    images,
  }
}

/**
 * Parse email content and extract relevant information
 */
export async function parseEmail(rawEmail: Buffer | string): Promise<ParsedEmail> {
  const parsed = await simpleParser(rawEmail)

  const { textContent, htmlContent, links, images } = extractEmailContent({
    text: parsed.text || null,
    html: parsed.html || null,
  })
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'lib/parsers/email-parser.ts:52',message:'parseEmail cleaned text/links/images',data:{hasHtml:Boolean(parsed.html),textLen:textContent.length,cleanedLen:textContent.length,trackingFound:hasSubstackTracking(parsed.text || ''),links:links.length,images:images.length},timestamp:Date.now()})}).catch(()=>{});
  // #endregion agent log

  return {
    subject: parsed.subject || 'No Subject',
    from: parsed.from?.value[0]?.address || '',
    fromName: parsed.from?.value[0]?.name,
    date: parsed.date || new Date(),
    textContent,
    htmlContent,
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
  const nonTrackingImages = parsedEmail.images.filter(
    (image) => image.startsWith('http') && !isSubstackTrackingImage(image)
  )
  const preferredHighRes = nonTrackingImages.find((image) =>
    /bucketeer|s3\.amazonaws\.com|_\d{3,4}x\d{3,4}\./i.test(image)
  )
  const preferredFetch = nonTrackingImages.find((image) =>
    /substackcdn\.com\/image\/fetch/i.test(image)
  )
  const thumbnail = preferredHighRes || preferredFetch || nonTrackingImages[0] || null
  const url = parsedEmail.links.find((link) => 
    link.startsWith('http') && !link.includes('unsubscribe')
  ) || parsedEmail.links[0] || '#'
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H2',location:'lib/parsers/email-parser.ts:91',message:'emailToFeedItem excerpt/thumbnail',data:{excerptStartsWithTracking:hasSubstackTracking(excerpt || ''),excerptLen:excerpt?.length ?? 0,thumbnailPresent:Boolean(thumbnail),thumbnailHost:thumbnail ? safeUrlHost(thumbnail) : null,thumbnailIsFetch:typeof thumbnail==='string' && /substackcdn\.com\/image\/fetch/i.test(thumbnail),thumbnailIsBucket:typeof thumbnail==='string' && /bucketeer|s3\.amazonaws\.com/i.test(thumbnail),links:parsedEmail.links.length,images:parsedEmail.images.length},timestamp:Date.now()})}).catch(()=>{});
  // #endregion agent log

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

function isSubstackTrackingLink(href: string): boolean {
  return /https?:\/\/eotrx\.substackcdn\.com\/open\?token=/i.test(href)
}

function isSubstackTrackingImage(url: string): boolean {
  if (!url) return false
  return /https?:\/\/eotrx\.substackcdn\.com\//i.test(url) ||
    /eotrx\.substackcdn\.com\/open\?token=/i.test(url)
}

export function stripSubstackTracking(text: string): string {
  return text
    .replace(/\[?https?:\/\/eotrx\.substackcdn\.com\/open\?token=[^\s\]]+\]?/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function hasSubstackTracking(text: string): boolean {
  return /https?:\/\/eotrx\.substackcdn\.com\/open\?token=/i.test(text)
}

function safeUrlHost(url: string): string | null {
  try {
    return new URL(url).host
  } catch {
    return null
  }
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
