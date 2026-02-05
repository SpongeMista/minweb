'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Hls from 'hls.js'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@/components/ui/use-toast'
import NotesPanel from '@/components/NotesPanel'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

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
    is_video?: boolean
    media?: {
      reddit_video?: {
        fallback_url?: string
        width?: number
        height?: number
        is_gif?: boolean
      }
    } | null
    secure_media?: {
      reddit_video?: {
        fallback_url?: string
        width?: number
        height?: number
        is_gif?: boolean
      }
    } | null
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
          className="underline underline-offset-2 break-all"
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
  const router = useRouter()
  const id = params?.id
  const searchParams = useSearchParams()
  const fromBookmarks = searchParams.get('from') === 'bookmarks'
  const backHref = fromBookmarks ? '/bookmarks' : '/'
  const backLabel = fromBookmarks ? 'Back to Bookmarks' : 'Back to Feed'
  const [item, setItem] = useState<RedditItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const queryClient = useQueryClient()
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

  const redditVideo = useMemo(() => {
    if (!item?.rawPayload) return null
    const raw = item.rawPayload
    const redditVideoPayload = raw.secure_media?.reddit_video ?? raw.media?.reddit_video
    const fallbackUrl = redditVideoPayload?.fallback_url
    if (!fallbackUrl) return null
    const normalizedUrl = fallbackUrl.replace(/&amp;/g, '&')
    const normalizedHlsUrl =
      redditVideoPayload?.hls_url?.replace(/&amp;/g, '&') ?? null
    const normalizedDashUrl =
      redditVideoPayload?.dash_url?.replace(/&amp;/g, '&') ?? null
    return {
      url: normalizedUrl,
      hlsUrl: normalizedHlsUrl,
      dashUrl: normalizedDashUrl,
      width: redditVideoPayload?.width ?? null,
      height: redditVideoPayload?.height ?? null,
      isGif: Boolean(redditVideoPayload?.is_gif),
    }
  }, [item])

  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !redditVideo?.hlsUrl) return
    let hls: Hls | null = null
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = redditVideo.hlsUrl
    } else if (Hls.isSupported()) {
      hls = new Hls()
      hls.loadSource(redditVideo.hlsUrl)
      hls.attachMedia(video)
    }
    return () => {
      if (hls) {
        hls.destroy()
      }
    }
  }, [redditVideo?.hlsUrl])

  const videoAspectPadding = useMemo(() => {
    if (!redditVideo?.width || !redditVideo?.height) return '56.25%'
    return `${(redditVideo.height / redditVideo.width) * 100}%`
  }, [redditVideo])

  const externalUrl = useMemo(() => {
    const url = item?.rawPayload?.url
    if (url && !url.includes('reddit.com')) {
      return url
    }
    return null
  }, [item])

  const updateFeedCache = (updater: (pageItem: any) => any) => {
    queryClient.setQueryData(['feed'], (current: any) => {
      if (!current?.pages) return current
      const nextPages = current.pages.map((page: any) => ({
        ...page,
        items: Array.isArray(page.items) ? page.items.map(updater).filter(Boolean) : page.items,
      }))
      return { ...current, pages: nextPages }
    })
  }

  const updateBookmarksCache = (updater: (items: any[]) => any[]) => {
    queryClient.setQueryData(['bookmarks'], (current: any) => {
      if (!Array.isArray(current?.items)) return current
      return { ...current, items: updater(current.items) }
    })
  }

  const deleteItem = async () => {
    if (!item?.id) return
    const previousFeed = queryClient.getQueryData(['feed'])
    const previousBookmarks = queryClient.getQueryData(['bookmarks'])
    const restoreCaches = () => {
      if (previousFeed) queryClient.setQueryData(['feed'], previousFeed)
      if (previousBookmarks) queryClient.setQueryData(['bookmarks'], previousBookmarks)
    }
    updateFeedCache((pageItem) => (pageItem?.id === item.id ? null : pageItem))
    if (fromBookmarks) {
      updateBookmarksCache((items) => items.filter((bookmarkItem: any) => bookmarkItem?.id !== item.id))
    }
    setIsDeleting(true)
    try {
      if (fromBookmarks) {
        const unbookmarkRes = await fetch('/api/bookmarks', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedItemId: item.id, restoreFeedItem: false }),
        })
        if (!unbookmarkRes.ok) {
          throw new Error('Failed to remove bookmark')
        }
      }
      const res = await fetch(`/api/feed/${item.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        throw new Error('Failed to delete item')
      }
      sessionStorage.setItem(
        'lastDeletedSource',
        fromBookmarks ? 'bookmarks-detail' : 'feed-detail'
      )
      sessionStorage.setItem('lastDeletedId', item.id)
      toast({ title: 'Item deleted' })
      router.push(backHref)
    } catch (error) {
      restoreCaches()
      toast({ title: 'Delete failed', description: String(error) })
    } finally {
      setIsDeleting(false)
      setConfirmDeleteOpen(false)
    }
  }

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
    if (!item?.id || fromBookmarks) return
    sessionStorage.setItem('feedActiveAfterBack', item.id)
  }, [item?.id, fromBookmarks])

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      return target.isContentEditable
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      if (event.key === 'Escape') {
        event.preventDefault()
        router.push(backHref)
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        if (!item?.id) return
        const feedData = queryClient.getQueryData(['feed']) as any
        const feedItems = feedData?.pages?.flatMap((page: any) => page.items) ?? []
        const currentIndex = feedItems.findIndex((entry: any) => entry?.id === item.id)
        const nextItem =
          currentIndex > -1 ? feedItems[currentIndex + 1] ?? feedItems[currentIndex - 1] : null
        if (nextItem?.id) {
          sessionStorage.setItem('feedActiveAfterDelete', nextItem.id)
        }
        void deleteItem()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [router, backHref, item?.id, queryClient])

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
        <main className="max-w-[1064px] mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
            <div className="w-full max-w-[720px] mx-auto lg:mx-0">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-9 w-9 rounded-full bg-gray-100" />
                <div>
                  <div className="h-6 w-56 bg-gray-100 rounded" />
                  <div className="mt-2 h-4 w-40 bg-gray-100 rounded" />
                </div>
              </div>
              <div className="bg-white rounded-[8px] p-5">
                <div className="h-40 w-full bg-gray-100 rounded" />
                <div className="mt-4 space-y-2">
                  <div className="h-4 w-5/6 bg-gray-100 rounded" />
                  <div className="h-4 w-4/6 bg-gray-100 rounded" />
                  <div className="h-4 w-3/6 bg-gray-100 rounded" />
                </div>
              </div>
            </div>
            <aside className="w-full max-w-[720px] mx-auto lg:max-w-none lg:mx-0 lg:sticky lg:top-16 h-fit">
              <div className="bg-white rounded-[8px] p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="h-5 w-20 bg-gray-100 rounded" />
                  <div className="h-4 w-12 bg-gray-100 rounded" />
                </div>
                <div className="h-10 w-full bg-gray-100 rounded-[8px] mb-4" />
                <div className="space-y-3">
                  <div className="h-4 w-full bg-gray-100 rounded" />
                  <div className="h-4 w-5/6 bg-gray-100 rounded" />
                  <div className="h-4 w-4/6 bg-gray-100 rounded" />
                </div>
              </div>
            </aside>
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
      <main className="max-w-[1064px] mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
          <div className="w-full max-w-[720px] mx-auto lg:mx-0">
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
                    const nextIsBookmarked = !isBookmarked
                    const previousFeed = queryClient.getQueryData(['feed'])
                    const previousBookmarks = queryClient.getQueryData(['bookmarks'])
                    setIsBookmarked(nextIsBookmarked)
                    if (nextIsBookmarked) {
                      updateBookmarksCache((items) => {
                        if (items.some((bookmarkItem: any) => bookmarkItem?.id === item.id)) return items
                        return [item, ...items]
                      })
                    } else {
                      updateBookmarksCache((items) =>
                        items.filter((bookmarkItem: any) => bookmarkItem?.id !== item.id)
                      )
                    }
                    updateFeedCache((pageItem) => {
                      if (pageItem?.id !== item.id) return pageItem
                      return {
                        ...pageItem,
                        bookmarks: nextIsBookmarked ? [{ id: 'optimistic' }] : [],
                      }
                    })
                    try {
                      if (!nextIsBookmarked) {
                        await fetch('/api/bookmarks', {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ feedItemId: item.id }),
                        })
                      } else {
                        await fetch('/api/bookmarks', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ feedItemId: item.id }),
                        })
                        toast({ title: 'This item has been bookmarked' })
                      }
                    } catch (error) {
                      setIsBookmarked(!nextIsBookmarked)
                      if (previousFeed) {
                        queryClient.setQueryData(['feed'], previousFeed)
                      }
                      if (previousBookmarks) {
                        queryClient.setQueryData(['bookmarks'], previousBookmarks)
                      }
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
                <button
                  type="button"
                  aria-label="Delete item"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => setConfirmDeleteOpen(true)}
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
                      d="M3 6h18"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M10 11v6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M14 11v6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <article className="bg-white rounded-[8px] p-5 space-y-4" ref={contentRef}>
              {redditVideo?.url ? (
                <div className="relative w-full overflow-hidden rounded-[8px] bg-black">
                  <div style={{ paddingTop: videoAspectPadding }} />
                  <video
                    ref={videoRef}
                    className="absolute inset-0 h-full w-full"
                    src={redditVideo.hlsUrl ? undefined : redditVideo.url}
                    controls
                    playsInline
                    preload="metadata"
                    muted={redditVideo.isGif}
                    loop={redditVideo.isGif}
                    poster={item.thumbnail ?? undefined}
                    onLoadedMetadata={(event) => {
                      const video = event.currentTarget
                    }}
                    onPlay={(event) => {
                      const video = event.currentTarget
                    }}
                    onVolumeChange={(event) => {
                      const video = event.currentTarget
                    }}
                  />
                </div>
              ) : (
                item.thumbnail && (
                  <img
                    src={item.thumbnail}
                    alt=""
                    className="w-full max-h-[360px] object-cover rounded-[8px]"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                )
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
          </div>
          <aside className="w-full max-w-[720px] mx-auto lg:max-w-none lg:mx-0 lg:sticky lg:top-16 h-fit">
            <NotesPanel feedItemId={item.id} />
          </aside>
        </div>
      </main>
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete item</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the item from your feed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteItem} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
