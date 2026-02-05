'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { useToast } from '@/components/ui/use-toast'

interface FeedItemProps {
  item: {
    id: string
    source: 'substack' | 'youtube' | 'reddit'
    sourceId?: string
    title: string
    author: string | null
    publishedAt: string
    excerpt: string | null
    emailText?: string | null
    emailHtml?: string | null
    url: string
    thumbnail: string | null
    rawPayload?: {
      subreddit?: string
      images?: string[]
    } | null
    bookmarks?: Array<{ id: string }>
    bookmarkCount?: number
    notesCount?: number
  }
  hideThumbnails?: boolean
  greyscaleThumbnails?: boolean
  isBookmarksList?: boolean
  isActive?: boolean
  onHover?: () => void
}

export default function FeedItem({
  item,
  hideThumbnails = false,
  greyscaleThumbnails = false,
  isBookmarksList = false,
  isActive = false,
  onHover,
}: FeedItemProps) {
  const timeAgo = formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })
  const isYoutube = item.source === 'youtube'
  const isReddit = item.source === 'reddit'
  const isSubstack = item.source === 'substack'
  const sanitizeSubstackPreview = (value?: string | null) => {
    if (typeof value !== 'string') return value
    const tokens = value.split(/\s+/).filter((token) => {
      const normalized = token.replace(/^[\[\(]+|[\]\),.]+$/g, '')
      return !/eotrx\.substackcdn\.com\/open\?token=|substackcdn\.com\/image\/fetch/i.test(normalized)
    })
    return tokens.join(' ').replace(/\s{2,}/g, ' ').trim()
  }
  const cleanedEmailText = sanitizeSubstackPreview(item.emailText)
  const cleanedExcerpt = sanitizeSubstackPreview(item.excerpt)
  const emailPreview = isSubstack
    ? cleanedExcerpt || cleanedEmailText
    : item.excerpt
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [thumbnailError, setThumbnailError] = useState(false)
  const metaGrayClass = 'text-gray-400'
  const youtubeIconClass = greyscaleThumbnails ? metaGrayClass : 'text-red-500'
  const redditIconClass = greyscaleThumbnails ? metaGrayClass : 'text-orange-500'
  const emailTextHasImageFetch =
    typeof item.emailText === 'string' &&
    /substackcdn\.com\/image\/fetch/i.test(item.emailText)
  const textImageMatch =
    typeof item.emailText === 'string'
      ? item.emailText.match(/https?:\/\/substackcdn\.com\/image\/fetch[^\s\]]+/i)
      : null
  const excerptImageMatch =
    typeof item.excerpt === 'string'
      ? item.excerpt.match(/https?:\/\/substackcdn\.com\/image\/fetch[^\s\]]+/i)
      : null
  const htmlImageMatch =
    typeof item.emailHtml === 'string'
      ? item.emailHtml.match(/https?:\/\/[^"' )]+substackcdn\.com\/image\/fetch[^"' )]+/i)
      : null
  const htmlHasImageFetch = Boolean(htmlImageMatch)
  const fallbackThumbnail =
    isSubstack && !item.thumbnail
      ? (item.rawPayload?.images?.find((image) => image.startsWith('http')) ??
        (textImageMatch ? textImageMatch[0] : null) ??
        (excerptImageMatch ? excerptImageMatch[0] : null))
      : null
  const effectiveThumbnail = thumbnailError
    ? null
    : item.thumbnail || fallbackThumbnail
  const effectiveThumbnailHost = effectiveThumbnail
    ? (() => {
        try {
          return new URL(effectiveThumbnail).host
        } catch {
          return null
        }
      })()
    : null
  const showThumbnail = !hideThumbnails && (effectiveThumbnail || isSubstack || isReddit)
  const displayAuthor =
    isReddit && item.rawPayload?.subreddit ? `r/${item.rawPayload.subreddit}` : item.author
  const bookmarkCount = item.bookmarkCount ?? item.bookmarks?.length ?? 0
  const notesCount = item.notesCount ?? 0
  const isBookmarked = isBookmarksList || bookmarkCount > 0
  const hasNotes = notesCount > 0
  const notesLabel = notesCount === 1 ? '1 note' : `${notesCount} notes`
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
      return {
        ...current,
        items: updater(current.items),
      }
    })
  }
  const restoreItem = async () => {
    if (!item.id) return
    const res = await fetch(`/api/feed/${item.id}`, { method: 'PATCH' })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to restore' }))
      throw new Error(error.error || 'Failed to restore')
    }
    queryClient.invalidateQueries({ queryKey: ['feed'] })
  }

  const deleteItem = async () => {
    if (!item.id || isDeleting) return
    const previousFeed = queryClient.getQueryData(['feed'])
    const previousBookmarks = queryClient.getQueryData(['bookmarks'])
    const restoreCaches = () => {
      if (previousFeed) {
        queryClient.setQueryData(['feed'], previousFeed)
      }
      if (previousBookmarks) {
        queryClient.setQueryData(['bookmarks'], previousBookmarks)
      }
    }
    updateFeedCache((pageItem) => (pageItem?.id === item.id ? null : pageItem))
    updateBookmarksCache((items) => items.filter((bookmarkItem: any) => bookmarkItem?.id !== item.id))
    setIsDeleting(true)
    try {
      const deleteEndpoint = isBookmarksList ? '/api/bookmarks' : `/api/feed/${item.id}`
      const deleteOptions: RequestInit = isBookmarksList
        ? {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ feedItemId: item.id }),
          }
        : { method: 'DELETE' }
      const res = await fetch(deleteEndpoint, deleteOptions)
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to delete' }))
        throw new Error(error.error || 'Failed to delete')
      }
      sessionStorage.setItem('lastDeletedId', item.id)
      sessionStorage.setItem('lastDeletedSource', isBookmarksList ? 'bookmarks' : 'feed')
      const { dismiss } = toast({
        title: 'Item deleted',
        duration: 3000,
        action: (
          <button
            type="button"
            className="text-sm text-gray-700 underline underline-offset-2 hover:text-gray-900"
            onClick={async (event) => {
              event.preventDefault()
              restoreCaches()
              try {
                if (isBookmarksList) {
                  const res = await fetch('/api/bookmarks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ feedItemId: item.id }),
                  })
                  if (!res.ok) {
                    const error = await res.json().catch(() => ({ error: 'Failed to bookmark' }))
                    throw new Error(error.error || 'Failed to bookmark')
                  }
                } else {
                  await restoreItem()
                }
              } catch (error) {
                toast({ title: 'Undo failed', description: String(error) })
              } finally {
                dismiss()
              }
            }}
          >
            Undo
          </button>
        ),
      })
    } catch (error) {
      restoreCaches()
      toast({ title: 'Delete failed', description: String(error) })
    } finally {
      setIsDeleting(false)
      setConfirmOpen(false)
    }
  }

  useEffect(() => {
    const handleDeleteEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ id?: string }>
      if (customEvent.detail?.id === item.id) {
        void deleteItem()
      }
    }

    window.addEventListener('feed-item-delete', handleDeleteEvent as EventListener)
    return () => {
      window.removeEventListener('feed-item-delete', handleDeleteEvent as EventListener)
    }
  }, [item.id, deleteItem])

  const bookmarkItem = async () => {
    if (!item.id) return
    setMenuOpen(false)
    const previousBookmarks = queryClient.getQueryData(['bookmarks'])
    const previousFeed = queryClient.getQueryData(['feed'])
    updateBookmarksCache((items) => {
      if (items.some((bookmarkItem: any) => bookmarkItem?.id === item.id)) return items
      return [
        {
          ...item,
          bookmarkCount: Math.max(item.bookmarkCount ?? 0, 1),
          notesCount: item.notesCount ?? 0,
        },
        ...items,
      ]
    })
    updateFeedCache((pageItem) => {
      if (pageItem?.id !== item.id) return pageItem
      if (!isBookmarksList) return null
      return {
        ...pageItem,
        bookmarks: [{ id: 'optimistic' }],
        bookmarkCount: Math.max(pageItem.bookmarkCount ?? 0, 1),
      }
    })
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedItemId: item.id }),
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to bookmark' }))
        throw new Error(error.error || 'Failed to bookmark')
      }
      toast({ title: 'This item has been bookmarked' })
    } catch (error) {
      if (previousBookmarks) {
        queryClient.setQueryData(['bookmarks'], previousBookmarks)
      }
      if (previousFeed) {
        queryClient.setQueryData(['feed'], previousFeed)
      }
      toast({ title: 'Bookmark failed', description: String(error) })
    }
  }

  const removeBookmark = async () => {
    if (!item.id) return
    setMenuOpen(false)
    const previousBookmarks = queryClient.getQueryData(['bookmarks'])
    const previousFeed = queryClient.getQueryData(['feed'])
    updateBookmarksCache((items) => items.filter((bookmarkItem: any) => bookmarkItem?.id !== item.id))
    updateFeedCache((pageItem) => {
      if (pageItem?.id !== item.id) return pageItem
      return {
        ...pageItem,
        bookmarks: [],
        bookmarkCount: 0,
      }
    })
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedItemId: item.id }),
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to remove bookmark' }))
        throw new Error(error.error || 'Failed to remove bookmark')
      }
    } catch (error) {
      if (previousBookmarks) {
        queryClient.setQueryData(['bookmarks'], previousBookmarks)
      }
      if (previousFeed) {
        queryClient.setQueryData(['feed'], previousFeed)
      }
      toast({ title: 'Remove bookmark failed', description: String(error) })
    }
  }

  useEffect(() => {
    const handleBookmarkEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ id?: string }>
      if (customEvent.detail?.id !== item.id) return
      if (isBookmarksList) {
        void removeBookmark()
      } else {
        void bookmarkItem()
      }
    }

    window.addEventListener('feed-item-bookmark', handleBookmarkEvent as EventListener)
    return () => {
      window.removeEventListener('feed-item-bookmark', handleBookmarkEvent as EventListener)
    }
  }, [item.id, isBookmarksList, bookmarkItem, removeBookmark])

  const menu = (
    <div className="absolute right-3 top-3 z-10">
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="More options"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus:outline-none"
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle cx="12" cy="5" r="2.25" fill="currentColor" />
              <circle cx="12" cy="12" r="2.25" fill="currentColor" />
              <circle cx="12" cy="19" r="2.25" fill="currentColor" />
            </svg>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              setMenuOpen(false)
              if (isBookmarksList) {
                removeBookmark()
              } else {
                bookmarkItem()
              }
            }}
          >
            <span className="mr-2 inline-flex">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path
                  d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="flex-1">{isBookmarksList ? 'Remove bookmark' : 'Bookmark'}</span>
            <span className="ml-2 inline-flex min-w-[28px] justify-center rounded border border-gray-200 px-1.5 py-0.5 text-[11px] text-gray-500">
              B
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600"
            onSelect={(event) => {
              event.preventDefault()
              if (item.id) {
                setMenuOpen(false)
                setConfirmOpen(true)
              }
            }}
          >
            <span className="mr-2 inline-flex" data-delete-item>
              <svg
                data-delete-icon
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                className="h-4 w-4 no-greyscale"
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
            </span>
            <span className="flex-1">Delete</span>
            <span className="ml-2 inline-flex min-w-[32px] justify-center rounded border border-gray-200 px-1.5 py-0.5 text-[11px] text-gray-500">
              Del
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  const bookmarkBadge = isBookmarked ? (
    <span className="absolute right-12 top-[-10px] z-10 inline-flex h-8 w-8 items-center justify-center text-[#FF2D55]">
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="h-5 w-5"
      >
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
      </svg>
    </span>
  ) : null

  const confirmDialog = (
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
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
  )
  const content = (
    <article className="bg-white rounded-[8px] p-5 w-full">
      <div className={`flex items-start ${showThumbnail ? 'gap-4' : ''}`}>
        {showThumbnail && (
          <div
            className={`flex-shrink-0 w-32 h-24 overflow-hidden rounded-[8px] flex items-center justify-center ${
              item.thumbnail
                ? 'bg-gray-100'
                : greyscaleThumbnails
                  ? 'bg-gray-100'
                  : isReddit
                    ? 'bg-[#FFBEA7]'
                    : 'bg-[#FFF7CC]'
            } ${greyscaleThumbnails ? 'grayscale' : ''}`}
          >
            {effectiveThumbnail ? (
              <img
                src={effectiveThumbnail}
                alt=""
                className="w-full h-full object-cover"
                onError={() => {
                  setThumbnailError(true)
                }}
              />
            ) : (
              <>
                {isReddit ? (
                  <img
                    src="/reddit-logo.png"
                    alt=""
                    className={`h-6 w-6 ${greyscaleThumbnails ? 'grayscale' : ''}`}
                  />
                ) : (
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <rect
                      x="3"
                      y="5"
                      width="18"
                      height="14"
                      rx="2"
                      stroke={greyscaleThumbnails ? '#9CA3AF' : '#FFCE73'}
                      strokeWidth="1.5"
                    />
                    <path
                      d="M3 7l9 6 9-6"
                      stroke={greyscaleThumbnails ? '#9CA3AF' : '#FFCE73'}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </>
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isYoutube ? (
              <span className={`inline-flex items-center ${youtubeIconClass}`}>
                <svg
                  width="22"
                  height="16"
                  viewBox="0 0 22 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <rect width="22" height="16" rx="4" fill="currentColor" />
                  <path d="M8.5 4.5L15 8L8.5 11.5V4.5Z" fill="#FFFFFF" />
                </svg>
              </span>
            ) : isReddit ? (
              <span className={`inline-flex items-center ${redditIconClass}`}>
                <img
                  src="/reddit-logo.png"
                  alt=""
                  className={`h-4 w-4 ${greyscaleThumbnails ? 'grayscale' : ''}`}
                />
              </span>
            ) : (
              <span
                className={`inline-flex items-center ${
                  greyscaleThumbnails ? metaGrayClass : 'text-[#FFCE73]'
                }`}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            )}
            {displayAuthor && (
              <span className="text-sm text-gray-600">{displayAuthor}</span>
            )}
            <span className={`text-xs ${metaGrayClass}`}>·</span>
            <span className={`text-xs ${metaGrayClass}`}>{timeAgo}</span>
          </div>
          <h3 className="text-lg font-semibold mb-2 leading-snug line-clamp-2">
            {item.title}
          </h3>
          {emailPreview && (
            <p className="text-sm text-gray-600 line-clamp-2">{emailPreview}</p>
          )}
          {hasNotes && (
            <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
              {hasNotes && (
                <span className="inline-flex items-center gap-2">
                  <svg
                    viewBox="0 0 750 750"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                    className="h-4 w-4"
                  >
                    <path
                      d="M214.5 365.5L534.5 365.5"
                      stroke="currentColor"
                      strokeWidth="57"
                      strokeLinecap="round"
                    />
                    <path
                      d="M214.5 233.5L534.5 233.5"
                      stroke="currentColor"
                      strokeWidth="57"
                      strokeLinecap="round"
                    />
                    <path
                      d="M214.5 497.5L364.5 497.5"
                      stroke="currentColor"
                      strokeWidth="57"
                      strokeLinecap="round"
                    />
                    <path
                      d="M636.5 0C699.184 0 750 50.8157 750 113.5V522.565C750 533.174 745.786 543.348 738.284 550.85L551.232 737.901C543.8 745.333 533.742 749.542 523.231 749.616L469 750H113.5C50.8157 750 0 699.184 0 636.5V113.5C0 50.8157 50.8157 0 113.5 0H636.5ZM113.5 75C92.237 75 75 92.237 75 113.5V636.5C75 657.763 92.237 675 113.5 675H469V578.5C469 528.794 509.294 488.5 559 488.5H675V113.5C675 92.237 657.763 75 636.5 75H113.5Z"
                    />
                  </svg>
                  <span>{notesLabel}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  )
  const detailSuffix = isBookmarksList ? '?from=bookmarks' : ''
  const detailHref = item.id
    ? isYoutube
      ? `/youtube/${item.id}${detailSuffix}`
      : isReddit
        ? `/reddit/${item.id}${detailSuffix}`
        : `/email/${item.id}${detailSuffix}`
    : null

  if (isYoutube) {
    return (
      <div
        className="relative"
        data-feed-item-id={item.id}
        data-detail-href={detailHref ?? undefined}
        onMouseEnter={onHover}
      >
        {isActive && (
          <span
            className="absolute left-0 top-0 h-full w-1 bg-black rounded-l-[8px]"
            aria-hidden="true"
          />
        )}
        {bookmarkBadge}
        {menu}
        {confirmDialog}
        <Link
          href={detailHref ?? '#'}
          className="block no-underline"
          onClick={() => {
            if (!isBookmarksList) {
              sessionStorage.setItem('feedScrollOverride', '1')
              sessionStorage.setItem('feedScrollY', String(window.scrollY))
              sessionStorage.setItem('feedRestoreKey', item.id)
            }
          }}
        >
          {content}
        </Link>
      </div>
    )
  }

  if (isReddit) {
    return (
      <div
        className="relative"
        data-feed-item-id={item.id}
        data-detail-href={detailHref ?? undefined}
        onMouseEnter={onHover}
      >
        {isActive && (
          <span
            className="absolute left-0 top-0 h-full w-1 bg-black rounded-l-[8px]"
            aria-hidden="true"
          />
        )}
        {bookmarkBadge}
        {menu}
        {confirmDialog}
        <Link
          href={detailHref ?? '#'}
          className="block no-underline"
          onClick={() => {
            if (!isBookmarksList) {
              sessionStorage.setItem('feedScrollOverride', '1')
              sessionStorage.setItem('feedScrollY', String(window.scrollY))
              sessionStorage.setItem('feedRestoreKey', item.id)
            }
          }}
        >
          {content}
        </Link>
      </div>
    )
  }

  if (!item.id) {
    return (
      <div className="relative">
        {menu}
        {confirmDialog}
        <div>{content}</div>
      </div>
    )
  }

  return (
    <div
      className="relative"
      data-feed-item-id={item.id}
      data-detail-href={detailHref ?? undefined}
      onMouseEnter={onHover}
    >
      {isActive && (
        <span
          className="absolute left-0 top-0 h-full w-1 bg-black rounded-l-[8px]"
          aria-hidden="true"
        />
      )}
      {bookmarkBadge}
      {menu}
      {confirmDialog}
      <Link
      href={detailHref ?? '#'}
        className="block no-underline"
        onClick={() => {
        if (!isBookmarksList) {
          sessionStorage.setItem('feedScrollOverride', '1')
          sessionStorage.setItem('feedScrollY', String(window.scrollY))
          sessionStorage.setItem('feedRestoreKey', item.id)
        }
        }}
      >
        {content}
      </Link>
    </div>
  )
}

