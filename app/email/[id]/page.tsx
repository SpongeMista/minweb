'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@/components/ui/use-toast'
import DetailPageLayout from '@/components/DetailPageLayout'
import { useNotesDrawer } from '@/components/NotesDrawerContext'
import { useHighlights } from '@/lib/useHighlights'
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

type EmailItem = {
  id: string
  title: string
  author: string | null
  publishedAt: string
  excerpt: string | null
  emailHtml?: string | null
  emailText?: string | null
  bookmarks?: Array<{ id: string }>
}

export default function EmailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id
  const searchParams = useSearchParams()
  const fromBookmarks = searchParams.get('from') === 'bookmarks'
  const backHref = fromBookmarks ? '/bookmarks' : '/'
  const backLabel = fromBookmarks ? 'Back to Bookmarks' : 'Back to Feed'
  const [item, setItem] = useState<EmailItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const contentRef = useRef<HTMLDivElement | null>(null)
  const notesDrawer = useNotesDrawer()
  const setFeedItemId = notesDrawer?.setFeedItemId
  const { applyNow } = useHighlights(item?.id ?? null, contentRef)

  useEffect(() => {
    if (item?.id) applyNow()
  }, [item?.id, applyNow])

  useEffect(() => {
    if (item?.id && setFeedItemId) {
      setFeedItemId(item.id)
    }
    return () => {
      setFeedItemId?.(null)
    }
  }, [item?.id, setFeedItemId])

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
        const res = await fetch(`/api/email/${id}`)
        if (!res.ok) {
          throw new Error('Failed to fetch email item')
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
  }, [item?.emailHtml, item?.emailText, item?.excerpt])

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

  if (isLoading) {
    return (
      <DetailPageLayout>
        <div className="min-h-screen bg-[#F5F5F5]">
          <main className="max-w-[720px] mx-auto px-4 py-8">
            <div className="w-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-9 w-9 rounded-full bg-gray-100" />
                <div>
                  <div className="h-6 w-56 bg-gray-100 rounded" />
                  <div className="mt-2 h-4 w-40 bg-gray-100 rounded" />
                </div>
              </div>
              <div className="bg-white rounded-[8px] p-5">
                <div className="h-4 w-1/2 bg-gray-100 rounded" />
                <div className="mt-2 h-4 w-5/6 bg-gray-100 rounded" />
                <div className="mt-2 h-4 w-2/3 bg-gray-100 rounded" />
                <div className="mt-6 h-4 w-3/4 bg-gray-100 rounded" />
                <div className="mt-2 h-4 w-1/2 bg-gray-100 rounded" />
              </div>
            </div>
          </main>
        </div>
      </DetailPageLayout>
    )
  }

  if (hasError || !item) {
    return (
      <DetailPageLayout>
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
              <h1 className="text-2xl font-semibold text-black">Email</h1>
            </div>
            <div className="bg-white rounded-[8px] p-5">
              <p className="text-sm text-gray-600">
                This email could not be loaded. It may have been removed or the link is invalid.
              </p>
            </div>
          </main>
        </div>
      </DetailPageLayout>
    )
  }

  return (
    <DetailPageLayout>
      <div className="min-h-screen bg-[#F5F5F5]">
        <main className="max-w-[720px] mx-auto px-4 py-8">
          <div className="w-full">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h1 className="text-2xl font-semibold text-black">{item.title}</h1>
                <div className="text-sm text-gray-600 mt-2">
                  {item.author && <span>{item.author}</span>}
                  {item.author && <span className="mx-2 text-gray-400">·</span>}
                  <span>{new Date(item.publishedAt).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
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

            <article className="bg-white rounded-[8px] p-5" ref={contentRef}>
              {item.emailHtml ? (
                <div
                  className="prose prose-sm max-w-none text-gray-700"
                  dangerouslySetInnerHTML={{ __html: item.emailHtml }}
                />
              ) : item.emailText ? (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.emailText}</p>
              ) : item.excerpt ? (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.excerpt}</p>
              ) : (
                <p className="text-sm text-gray-500">
                  This email did not include a readable body. Only the subject was available.
                </p>
              )}
            </article>
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
    </DetailPageLayout>
  )
}
