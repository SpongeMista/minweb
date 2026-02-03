'use client'

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useRouter } from 'next/navigation'
import FeedItem from '@/components/FeedItem'
import {
  readHideThumbnailsPreference,
  readHideThumbnailsPreferenceSync,
  useHideThumbnailsPreference,
  writeHideThumbnailsPreference,
} from '@/lib/use-hide-thumbnails'

async function fetchFeed(params: {
  cursor?: string
  limit?: number
}) {
  const queryParams = new URLSearchParams()
  if (params.cursor) queryParams.set('cursor', params.cursor)
  if (params.limit) queryParams.set('limit', String(params.limit))

  const res = await fetch(`/api/feed?${queryParams}`)
  if (!res.ok) throw new Error('Failed to fetch feed')
  const data = await res.json()
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H8',location:'app/feed/page.tsx:23',message:'client feed substack summary',data:{total:data?.items?.length ?? 0,substackCount:(data?.items||[]).filter((item:any)=>item.source==='substack').length,substackSample:(data?.items||[]).filter((item:any)=>item.source==='substack').slice(0,3).map((item:any)=>({excerptHasTracking:typeof item.excerpt==='string'&&item.excerpt.includes('eotrx.substackcdn.com/open?token='),emailTextHasTracking:typeof item.emailText==='string'&&item.emailText.includes('eotrx.substackcdn.com/open?token='),thumbnailPresent:Boolean(item.thumbnail),thumbnailHost:(()=>{try{return item.thumbnail?new URL(item.thumbnail).host:null}catch{return null}})()}))},timestamp:Date.now()})}).catch(()=>{});
  // #endregion agent log
  return data
}

async function syncFeeds() {
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'all' }),
  })
  if (!res.ok) throw new Error('Failed to sync')
  return res.json()
}

async function fetchSyncStatus() {
  const res = await fetch('/api/sync/status')
  if (!res.ok) throw new Error('Failed to fetch sync status')
  return res.json()
}

export default function FeedPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [pendingScrollY, setPendingScrollY] = useState<number | null>(null)
  const hasScrolledRef = useRef(false)
  const lastScrollYRef = useRef(0)
  const [syncInFlight, setSyncInFlight] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const feedTypeMeasureRef = useRef<HTMLSpanElement | null>(null)
  const [feedTypeSelectWidth, setFeedTypeSelectWidth] = useState<number | null>(null)

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isFetching,
  } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) =>
      fetchFeed({
        cursor: pageParam,
        limit: 10,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined,
  })

  const items = data?.pages.flatMap((page) => page.items) || []
  const serverHideThumbnails = data?.pages[0]?.hideThumbnails ?? false
  const serverGreyscaleThumbnails = data?.pages[0]?.greyscaleThumbnails ?? false
  const serverFeedType = data?.pages[0]?.feedType ?? 'balanced'
  const initialHideThumbnails = readHideThumbnailsPreferenceSync()
  const [localHideThumbnails, setLocalHideThumbnails] =
    useHideThumbnailsPreference(initialHideThumbnails)
  const effectiveHideThumbnails = localHideThumbnails ?? serverHideThumbnails
  const [feedType, setFeedType] = useState<'chronological' | 'balanced'>(serverFeedType)
  const feedTypeLabel = feedType === 'balanced' ? 'Balanced' : 'Timeline'
  const [activeItemId, setActiveItemId] = useState<string | null>(null)

  useEffect(() => {
    const changeStamp = sessionStorage.getItem('settingsChangeStamp')
    if (!changeStamp) return

    const syncAfterSettings = async () => {
      try {
        setSyncInFlight(true)
        await syncFeeds()
        const status = await fetchSyncStatus()
        setLastSyncedAt(status?.lastSyncedAt ? new Date(status.lastSyncedAt) : null)
        queryClient.invalidateQueries({ queryKey: ['feed'] })
        await refetch()
      } catch (error) {
        console.error('Sync after settings error:', error)
      } finally {
        setSyncInFlight(false)
        sessionStorage.removeItem('settingsChangeStamp')
      }
    }

    void syncAfterSettings()
  }, [queryClient, refetch])

  const isSyncing = syncInFlight || isFetching || isFetchingNextPage

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const status = await fetchSyncStatus()
        setLastSyncedAt(status?.lastSyncedAt ? new Date(status.lastSyncedAt) : null)
      } catch (error) {
        console.error('Sync status error:', error)
      }
    }

    void loadStatus()
  }, [])

  useEffect(() => {
    if (localHideThumbnails === null && serverHideThumbnails !== null) {
      const stored = readHideThumbnailsPreference()
      if (stored !== null) {
        setLocalHideThumbnails(stored)
        return
      }
      setLocalHideThumbnails(serverHideThumbnails)
    }
  }, [localHideThumbnails, serverHideThumbnails, setLocalHideThumbnails])

  useEffect(() => {
    if (localHideThumbnails === null && serverHideThumbnails !== null) {
      const stored = readHideThumbnailsPreference()
      if (stored === null) {
        writeHideThumbnailsPreference(serverHideThumbnails)
      }
    }
  }, [localHideThumbnails, serverHideThumbnails])

  useEffect(() => {
    setFeedType(serverFeedType)
  }, [serverFeedType])

  useEffect(() => {
    if (items.length === 0) {
      if (activeItemId !== null) {
        setActiveItemId(null)
      }
      return
    }
    if (!activeItemId || !items.some((item) => item.id === activeItemId)) {
      setActiveItemId(items[0].id)
    }
  }, [items, activeItemId])

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      return target.isContentEditable
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      if (items.length === 0) return

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const currentIndex = items.findIndex((item) => item.id === activeItemId)
        const fallbackIndex = currentIndex === -1 ? 0 : currentIndex
        const delta = event.key === 'ArrowDown' ? 1 : -1
        const nextIndex = Math.min(
          Math.max(fallbackIndex + delta, 0),
          items.length - 1
        )
        setActiveItemId(items[nextIndex].id)
        const target = document.querySelector<HTMLElement>(
          `[data-feed-item-id="${items[nextIndex].id}"]`
        )
        if (target) {
          const rect = target.getBoundingClientRect()
          const header = document.querySelector<HTMLElement>('[data-app-header]')
          const headerHeight = header?.offsetHeight ?? 0
          const topBoundary = headerHeight + 8
          const bottomBoundary = window.innerHeight - 8
          const isFullyVisible = rect.top >= topBoundary && rect.bottom <= bottomBoundary
          if (!isFullyVisible) {
            target.scrollIntoView({ block: 'nearest' })
            if (headerHeight) {
              requestAnimationFrame(() => {
                window.scrollBy(0, -headerHeight - 8)
              })
            }
          }
        }
        return
      }

      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        activeItemId
      ) {
        event.preventDefault()
        window.dispatchEvent(
          new CustomEvent('feed-item-delete', { detail: { id: activeItemId } })
        )
        return
      }

      if (event.key.toLowerCase() === 'b' && activeItemId) {
        event.preventDefault()
        window.dispatchEvent(
          new CustomEvent('feed-item-bookmark', { detail: { id: activeItemId } })
        )
        return
      }

      if (event.key === 'Enter' && activeItemId) {
        const target = document.querySelector<HTMLElement>(
          `[data-feed-item-id="${activeItemId}"]`
        )
        const href = target?.getAttribute('data-detail-href')
        if (href) {
          event.preventDefault()
          router.push(href)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [items, activeItemId])

  useLayoutEffect(() => {
    if (!feedTypeMeasureRef.current) return
    feedTypeMeasureRef.current.textContent = feedTypeLabel
    const textWidth = feedTypeMeasureRef.current.getBoundingClientRect().width
    if (Number.isFinite(textWidth) && textWidth > 0) {
      setFeedTypeSelectWidth(Math.ceil(textWidth))
    }
  }, [feedTypeLabel])

  useEffect(() => {
    const saved = sessionStorage.getItem('feedScrollY')
    const override = sessionStorage.getItem('feedScrollOverride')
    const restoreKey = sessionStorage.getItem('feedRestoreKey')
    const scrollRestoration = history.scrollRestoration
    history.scrollRestoration = 'manual'
    void scrollRestoration
    if (saved) {
      const parsed = Number(saved)
      if (!Number.isNaN(parsed)) {
        setPendingScrollY(parsed)
      }
    }
  }, [])

  useEffect(() => {
    if (pendingScrollY !== null && items.length > 0) {
      const restoreKey = sessionStorage.getItem('feedRestoreKey')
      requestAnimationFrame(() => {
        if (restoreKey && Number.isFinite(pendingScrollY)) {
          window.scrollTo(0, pendingScrollY)
        } else if (restoreKey) {
          const target = document.querySelector<HTMLElement>(
            `[data-feed-item-id="${restoreKey}"]`
          )
          const header = document.querySelector<HTMLElement>('[data-app-header]')
          const headerHeight = header?.offsetHeight ?? null
          if (target) {
            target.scrollIntoView({ block: 'start' })
            requestAnimationFrame(() => {
              const offset = headerHeight ? -headerHeight - 8 : 0
              if (offset) {
                window.scrollBy(0, offset)
              }
            })
          } else {
            window.scrollTo(0, pendingScrollY)
          }
        } else {
          window.scrollTo(0, pendingScrollY)
        }
      })
      sessionStorage.removeItem('feedScrollY')
      sessionStorage.removeItem('feedScrollOverride')
      sessionStorage.removeItem('feedRestoreKey')
      setPendingScrollY(null)
    }
  }, [pendingScrollY, items.length])

  useEffect(() => {
    const handleScroll = () => {
      lastScrollYRef.current = window.scrollY
      hasScrolledRef.current = true
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  useEffect(() => {
    return () => {
      const override = sessionStorage.getItem('feedScrollOverride')
      if (override === '1') {
      } else if (hasScrolledRef.current) {
        sessionStorage.setItem('feedScrollY', String(lastScrollYRef.current))
      } else {
      }
    }
  }, [])

  // Auto-sync on page load if stale
  useEffect(() => {
    const SYNC_THRESHOLD_MS = 60 * 1000
    let isActive = true

    const maybeSync = async () => {
      try {
        const status = await fetchSyncStatus()
        const lastSyncedAt = status?.lastSyncedAt ? new Date(status.lastSyncedAt) : null
        const shouldSync =
          !lastSyncedAt || Date.now() - lastSyncedAt.getTime() > SYNC_THRESHOLD_MS

        if (shouldSync && isActive) {
          setSyncInFlight(true)
          await syncFeeds()
          const nextStatus = await fetchSyncStatus()
          setLastSyncedAt(nextStatus?.lastSyncedAt ? new Date(nextStatus.lastSyncedAt) : null)
          if (isActive) {
            queryClient.invalidateQueries({ queryKey: ['feed'] })
            refetch()
          }
        }
      } catch (error) {
        console.error('Sync status error:', error)
      } finally {
        if (isActive) {
          setSyncInFlight(false)
        }
      }
    }

    void maybeSync()
    return () => {
      isActive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <main className="max-w-[648px] mx-auto px-4 py-8">
        <div className="space-y-4">
          <div className="feed-type-control">
            <span
              className="feed-type-label text-sm text-gray-700"
              style={feedTypeSelectWidth ? { minWidth: `${feedTypeSelectWidth}px` } : undefined}
              aria-hidden="true"
            >
              {feedTypeLabel}
            </span>
            <select
              value={feedType}
              onChange={async (event) => {
                const nextValue = event.target.value as 'chronological' | 'balanced'
                setFeedType(nextValue)
                await fetch('/api/settings', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ feedType: nextValue }),
                })
                queryClient.invalidateQueries({ queryKey: ['feed'] })
                refetch()
              }}
              className="feed-type-select text-sm text-gray-700"
              aria-label="Feed type"
            >
              <option value="chronological">Timeline</option>
              <option value="balanced">Balanced</option>
            </select>
            <span className="feed-type-caret" aria-hidden="true">
              <svg
                width="10"
                height="6"
                viewBox="0 0 10 6"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M1 1l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span
              ref={feedTypeMeasureRef}
              className="feed-type-measure text-sm text-gray-700"
              aria-hidden="true"
            />
          </div>
          {items.length === 0 && !isFetchingNextPage && (
            <div className="text-center py-12 text-gray-500">
              <p>No items in feed yet.</p>
              <p className="mt-2 text-sm">
                Add Substack newsletters, YouTube channels, or Reddit subreddits to get started.
              </p>
            </div>
          )}

          {items.map((item: any) => (
            <FeedItem
              key={item.id}
              item={item}
              hideThumbnails={effectiveHideThumbnails}
              greyscaleThumbnails={serverGreyscaleThumbnails}
              feedType={feedType}
              isActive={activeItemId === item.id}
              onHover={() => setActiveItemId(item.id)}
            />
          ))}

          {hasNextPage && (
            <div className="text-center py-8">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-6 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {isFetchingNextPage ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

