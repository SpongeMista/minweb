'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useToast } from '@/components/ui/use-toast'

type RedditItem = {
  id: string
  title: string
  author: string | null
  publishedAt: string
  url: string
  excerpt?: string | null
  thumbnail?: string | null
  bookmarks?: Array<{ id: string }>
  rawPayload?: {
    selftext?: string
    permalink?: string
    url?: string
    subreddit?: string
  } | null
}

function linkifyText(text: string) {
  const parts: Array<{ type: 'text' | 'link'; value: string }> = []
  const urlRegex = /https?:\/\/[^\s]+/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'link', value: match[0] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return parts.map((part, index) => {
    if (part.type === 'link') {
      return (
        <a
          key={`link-${index}`}
          href={part.value}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          {part.value}
        </a>
      )
    }

    return <span key={`text-${index}`}>{part.value}</span>
  })
}

export default function RedditPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const searchParams = useSearchParams()
  const fromBookmarks = searchParams.get('from') === 'bookmarks'
  const backHref = fromBookmarks ? '/bookmarks' : '/'
  const backLabel = fromBookmarks ? 'Back to Bookmarks' : 'Back to Feed'
  const [item, setItem] = useState<RedditItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const { toast } = useToast()
  const contentRef = useRef<HTMLDivElement | null>(null)

  const postText = useMemo(() => {
    const rawText = item?.rawPayload?.selftext?.trim() || item?.excerpt?.trim() || ''
    return rawText.length > 0 ? rawText : null
  }, [item])

  const redditUrl = useMemo(() => {
    if (!item) return null
    if (item.rawPayload?.permalink) {
      return `https://www.reddit.com${item.rawPayload.permalink}`
    }
    return item.url
  }, [item])

  const externalUrl = useMemo(() => {
    const url = item?.rawPayload?.url
    if (url && !url.includes('reddit.com')) {
      return url
    }
    return null
  }, [item])

  useEffect(() => {
    const fetchItem = async () => {
      if (!id) {
        setIsLoading(false)
        setHasError(true)
        return
      }
      setIsLoading(true)
      setHasError(false)
      try {
        const res = await fetch(`/api/reddit/${id}`)
        if (!res.ok) {
          throw new Error('Failed to fetch Reddit item')
        }
        const data = await res.json()
        setItem(data.item || null)
        setIsBookmarked(Boolean(data?.item?.bookmarks?.length))
      } catch (error) {
        setHasError(true)
      } finally {
        setIsLoading(false)
      }
    }

    fetchItem()
  }, [id])

  useEffect(() => {
    if (id) {
      window.scrollTo(0, 0)
    }
  }, [id])

  useEffect(() => {
    if (!contentRef.current) return
    const links = contentRef.current.querySelectorAll<HTMLAnchorElement>('a[href]')
    links.forEach((link) => {
      link.setAttribute('target', '_blank')
      link.setAttribute('rel', 'noreferrer')
    })
  }, [postText, externalUrl, redditUrl])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F5]">
        <main className="max-w-[648px] mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-full bg-gray-100" />
            <div>
              <div className="h-6 w-56 bg-gray-100 rounded" />
              <div className="mt-2 h-4 w-40 bg-gray-100 rounded" />
            </div>
          </div>
          <div className="bg-white rounded-[8px] p-5">
            <div className="h-40 w-full bg-gray-100 rounded" />
          </div>
        </main>
      </div>
    )
  }

  if (hasError || !item || !redditUrl) {
    return (
      <div className="min-h-screen bg-[#F5F5F5]">
        <main className="max-w-[648px] mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href={backHref}
              aria-label={backLabel}
              className="text-gray-600 hover:text-black transition-colors"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M15 18L9 12L15 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <h1 className="text-2xl font-semibold text-black">Reddit</h1>
          </div>
          <div className="bg-white rounded-[8px] p-5">
            <p className="text-sm text-gray-600">
              This post could not be loaded. It may have been removed or the link is invalid.
            </p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <main className="max-w-[648px] mx-auto px-4 py-8">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
          <Link
            href={backHref}
            aria-label={backLabel}
            className="text-gray-600 hover:text-black transition-colors pt-1"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-black">{item.title}</h1>
            <div className="text-sm text-gray-600 mt-2 flex flex-wrap items-center gap-2">
              {item.rawPayload?.subreddit && (
                <span className="text-gray-700">r/{item.rawPayload.subreddit}</span>
              )}
              {item.author && (
                <>
                  <span className="text-gray-400">·</span>
                  <span>{item.author}</span>
                </>
              )}
              <span className="text-gray-400">·</span>
              <span>{new Date(item.publishedAt).toLocaleString()}</span>
            </div>
          </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            {redditUrl && (
              <a
                href={redditUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Open on Reddit"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M14 4h6v6M20 4l-9 9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            )}
            <button
              type="button"
              aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark item'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={async () => {
                if (!item?.id) return
                try {
                  if (isBookmarked) {
                    await fetch('/api/bookmarks', {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ feedItemId: item.id }),
                    })
                    setIsBookmarked(false)
                  } else {
                    await fetch('/api/bookmarks', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ feedItemId: item.id }),
                    })
                    setIsBookmarked(true)
                    toast({ title: 'This item has been bookmarked' })
                  }
                } catch (error) {
                  toast({ title: 'Bookmark failed', description: String(error) })
                }
              }}
            >
              {isBookmarked ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
        <article className="bg-white rounded-[8px] p-5 space-y-4" ref={contentRef}>
          {item.thumbnail && (
            <img
              src={item.thumbnail}
              alt=""
              className="w-full max-h-[360px] object-cover rounded-[8px]"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          )}
          {postText && (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {linkifyText(postText)}
            </p>
          )}
          {externalUrl && (
            <a
              href={externalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center px-3 py-1 border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-sm"
            >
              Open link
            </a>
          )}
        </article>
      </main>
    </div>
  )
}
