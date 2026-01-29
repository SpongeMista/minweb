'use client'

import { useState } from 'react'
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
  }
  hideThumbnails?: boolean
  greyscaleThumbnails?: boolean
  isBookmarksList?: boolean
  feedType?: 'chronological' | 'balanced'
}

export default function FeedItem({
  item,
  hideThumbnails = false,
  greyscaleThumbnails = false,
  isBookmarksList = false,
  feedType,
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
  // #region agent log
  if (isSubstack) {
    const emailTextHasTracking =
      typeof item.emailText === 'string' &&
      item.emailText.includes('eotrx.substackcdn.com/open?token=')
    const excerptHasTracking =
      typeof item.excerpt === 'string' &&
      item.excerpt.includes('eotrx.substackcdn.com/open?token=')
    const previewHasImageFetch =
      typeof emailPreview === 'string' &&
      /substackcdn\.com\/image\/fetch/i.test(emailPreview)
    if (emailTextHasTracking || excerptHasTracking || !effectiveThumbnail || previewHasImageFetch) {
      fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H9',location:'components/FeedItem.tsx:63',message:'substack feed item render',data:{id:item.id,hasThumbnail:Boolean(item.thumbnail),hasEffectiveThumbnail:Boolean(effectiveThumbnail),emailTextHasTracking,excerptHasTracking,previewHasImageFetch,emailTextHasImageFetch,textImageMatch: Boolean(textImageMatch),hasEmailHtml:Boolean(item.emailHtml),htmlHasImageFetch,previewSource:cleanedExcerpt ? 'excerpt' : 'emailText'},timestamp:Date.now()})}).catch(()=>{});
    }
  }
  // #endregion agent log
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
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/feed/${item.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to delete' }))
        throw new Error(error.error || 'Failed to delete')
      }
      const { dismiss } = toast({
        title: 'Item deleted',
        duration: 3000,
        action: (
          <button
            type="button"
            className="text-sm text-gray-700 underline underline-offset-2 hover:text-gray-900"
            onClick={async (event) => {
              event.preventDefault()
              try {
                await restoreItem()
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
      if (!isBookmarksList && feedType === 'balanced') {
        queryClient.setQueryData(['feed'], (current: any) => {
          if (!current?.pages) return current
          const nextPages = current.pages.map((page: any) => ({
            ...page,
            items: Array.isArray(page.items)
              ? page.items.filter((pageItem: any) => pageItem?.id !== item.id)
              : page.items,
          }))
          return { ...current, pages: nextPages }
        })
      } else {
        queryClient.invalidateQueries({ queryKey: ['feed'] })
      }
    } catch (error) {
      toast({ title: 'Delete failed', description: String(error) })
    } finally {
      setIsDeleting(false)
      setConfirmOpen(false)
    }
  }

  const bookmarkItem = async () => {
    if (!item.id) return
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
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    } catch (error) {
      toast({ title: 'Bookmark failed', description: String(error) })
    } finally {
      setMenuOpen(false)
    }
  }

  const removeBookmark = async () => {
    if (!item.id) return
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
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    } catch (error) {
      toast({ title: 'Remove bookmark failed', description: String(error) })
    } finally {
      setMenuOpen(false)
    }
  }

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
            {isBookmarksList ? 'Remove bookmark' : 'Bookmark'}
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
            <span className="mr-2 inline-flex">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                className="h-4 w-4"
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
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

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
                onLoad={() => {
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H11',location:'components/FeedItem.tsx:368',message:'thumbnail load success',data:{id:item.id,source:item.source,thumbnailHost:effectiveThumbnailHost},timestamp:Date.now()})}).catch(()=>{});
                  // #endregion agent log
                }}
                onError={() => {
                  setThumbnailError(true)
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H10',location:'components/FeedItem.tsx:373',message:'thumbnail load error',data:{id:item.id,source:item.source,thumbnailHost:effectiveThumbnailHost},timestamp:Date.now()})}).catch(()=>{});
                  // #endregion agent log
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
        </div>
      </div>
    </article>
  )
  const detailSuffix = isBookmarksList ? '?from=bookmarks' : ''

  if (isYoutube) {
    return (
      <div className="relative" data-feed-item-id={item.id}>
        {menu}
        {confirmDialog}
        <Link
          href={`/youtube/${item.id}${detailSuffix}`}
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
      <div className="relative" data-feed-item-id={item.id}>
        {menu}
        {confirmDialog}
        <Link
          href={`/reddit/${item.id}${detailSuffix}`}
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
    <div className="relative" data-feed-item-id={item.id}>
      {menu}
      {confirmDialog}
      <Link
      href={`/email/${item.id}${detailSuffix}`}
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

