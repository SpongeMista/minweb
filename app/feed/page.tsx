'use client'

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
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
  return res.json()
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
  const [pendingScrollY, setPendingScrollY] = useState<number | null>(null)
  const hasScrolledRef = useRef(false)
  const lastScrollYRef = useRef(0)
  const [syncInFlight, setSyncInFlight] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)

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
  const initialHideThumbnails = readHideThumbnailsPreferenceSync()
  const [localHideThumbnails, setLocalHideThumbnails] =
    useHideThumbnailsPreference(initialHideThumbnails)
  const effectiveHideThumbnails = localHideThumbnails ?? serverHideThumbnails

  useEffect(() => {
    const changeStamp = sessionStorage.getItem('settingsChangeStamp')
    if (changeStamp) {
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      refetch()
      sessionStorage.removeItem('settingsChangeStamp')
    }
  }, [])

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
    const SYNC_THRESHOLD_MS = 5 * 60 * 1000
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
          {items.length === 0 && !isFetchingNextPage && (
            <div className="text-center py-12 text-gray-500">
              <p>No items in feed yet.</p>
              <p className="mt-2 text-sm">
                Add Substack newsletters or add YouTube channels to get started.
              </p>
            </div>
          )}

          {items.map((item: any) => (
            <FeedItem
              key={item.id}
              item={item}
              hideThumbnails={effectiveHideThumbnails}
              greyscaleThumbnails={serverGreyscaleThumbnails}
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
          <div className="text-xs text-gray-400 flex items-center justify-center gap-2">
            {isSyncing ? (
              <>
                <span className="inline-flex h-3 w-3 rounded-full border border-gray-400 border-t-transparent animate-spin" />
                <span>Syncing…</span>
              </>
            ) : (
              <span>
                {lastSyncedAt
                  ? `Last synced ${formatDistanceToNow(lastSyncedAt, { addSuffix: true })}`
                  : 'Last synced never'}
              </span>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

