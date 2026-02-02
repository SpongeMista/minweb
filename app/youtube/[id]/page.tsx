'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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

type YoutubeItem = {
  id: string
  title: string
  author: string | null
  publishedAt: string
  url: string
  sourceId?: string
  excerpt?: string | null
  bookmarks?: Array<{ id: string }>
  rawPayload?: {
    snippet?: {
      description?: string
    }
  } | null
}

function getYoutubeId(item: YoutubeItem) {
  if (item.sourceId) {
    return item.sourceId
  }
  try {
    const url = new URL(item.url)
    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.replace('/', '')
      return id || null
    }
    if (url.hostname.includes('youtube.com')) {
      return url.searchParams.get('v')
    }
  } catch (error) {
    return null
  }
  return null
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

export default function YoutubePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id
  const searchParams = useSearchParams()
  const fromBookmarks = searchParams.get('from') === 'bookmarks'
  const backHref = fromBookmarks ? '/bookmarks' : '/'
  const backLabel = fromBookmarks ? 'Back to Bookmarks' : 'Back to Feed'
  const [item, setItem] = useState<YoutubeItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const { toast } = useToast()
  const contentRef = useRef<HTMLDivElement | null>(null)

  const videoId = useMemo(() => (item ? getYoutubeId(item) : null), [item])
  const embedUrl = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=0&controls=1&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1`
    : null
  const externalUrl = useMemo(() => (item?.url ? item.url : null), [item])
  const descriptionText =
    item?.rawPayload?.snippet?.description?.trim() || item?.excerpt?.trim() || null
  const collapsedDescription = descriptionText
    ? descriptionText.split(/\r?\n/).filter(Boolean).slice(0, 3).join('\n')
    : null
  const isDescriptionTruncated =
    !!descriptionText && !!collapsedDescription && collapsedDescription.length < descriptionText.length

  const deleteItem = async () => {
    if (!item?.id) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/feed/${item.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        throw new Error('Failed to delete item')
      }
      toast({ title: 'Item deleted' })
      router.push(backHref)
    } catch (error) {
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'app/youtube/[id]/page.tsx:120',message:'fetch youtube item start',data:{id},timestamp:Date.now()})}).catch(()=>{});
      // #endregion agent log
      try {
        const res = await fetch(`/api/youtube/${id}`)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'app/youtube/[id]/page.tsx:125',message:'fetch youtube item response',data:{id,ok:res.ok,status:res.status},timestamp:Date.now()})}).catch(()=>{});
        // #endregion agent log
        if (!res.ok) {
          throw new Error('Failed to fetch YouTube item')
        }
        const data = await res.json()
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H2',location:'app/youtube/[id]/page.tsx:131',message:'fetch youtube item data',data:{id,itemId:data?.item?.id,sourceId:data?.item?.sourceId,url:data?.item?.url,hasItem:Boolean(data?.item)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion agent log
        setItem(data.item || null)
        setIsBookmarked(Boolean(data?.item?.bookmarks?.length))
      } catch (error) {
        setHasError(true)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'app/youtube/[id]/page.tsx:138',message:'fetch youtube item error',data:{id,error:String(error)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion agent log
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
  }, [descriptionText, collapsedDescription, isDescriptionExpanded])


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

  if (hasError || !item || !embedUrl) {
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
            <h1 className="text-2xl font-semibold text-black">YouTube</h1>
          </div>
          <div className="bg-white rounded-[8px] p-5">
            <p className="text-sm text-gray-600">
              This video could not be loaded. It may have been removed or the link is invalid.
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
                  <div className="text-sm text-gray-600 mt-2">
                    {item.author && <span>{item.author}</span>}
                    {item.author && <span className="mx-2 text-gray-400">·</span>}
                    <span>{new Date(item.publishedAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                {externalUrl && (
                  <a
                    href={externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open on YouTube"
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
            <article className="bg-white rounded-[8px] p-5" ref={contentRef}>
              <div className="relative w-full overflow-hidden rounded-[8px] bg-black">
                <div className="pt-[56.25%]" />
                <iframe
                  className="absolute inset-0 h-full w-full"
                  src={embedUrl}
                  title={item.title}
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  onLoad={() => {
                    setIframeLoaded(true)
                  }}
                />
                {!iframeLoaded && externalUrl && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 text-white">
                    <span className="text-sm text-gray-200">
                      Video preview isn&apos;t available here.
                    </span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-full border border-white/40 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
                      onClick={() => {
                        window.open(externalUrl, '_blank', 'noopener,noreferrer')
                      }}
                    >
                      Open on YouTube
                    </button>
                  </div>
                )}
              </div>
              {descriptionText && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {linkifyText(isDescriptionExpanded ? descriptionText : collapsedDescription)}
                  </p>
                  {isDescriptionTruncated && (
                    <button
                      type="button"
                      onClick={() => setIsDescriptionExpanded((prev) => !prev)}
                      className="mt-2 text-sm text-gray-600 underline underline-offset-2 hover:text-black transition-colors"
                    >
                      {isDescriptionExpanded ? 'Read less' : 'Read more...'}
                    </button>
                  )}
                </div>
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
