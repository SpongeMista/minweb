'use client'

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
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
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const pendingActiveRestoreRef = useRef<string | null>(null)
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
  const [activeItemId, setActiveItemId] = useState<string | null>(null)

  useEffect(() => {
    const lastDeletedId = sessionStorage.getItem('lastDeletedId')
    if (!lastDeletedId) return
    queryClient.setQueryData(['feed'], (existing: any) => {
      if (!existing?.pages) return existing
      const nextPages = existing.pages.map((page: any) => {
        if (!Array.isArray(page?.items)) return page
        return {
          ...page,
          items: page.items.filter((item: any) => item.id !== lastDeletedId),
        }
      })
      return { ...existing, pages: nextPages }
    })
    sessionStorage.removeItem('lastDeletedId')
  }, [queryClient])

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
    if (items.length === 0) {
      if (activeItemId !== null) {
        setActiveItemId(null)
      }
      return
    }
    const nextFromDelete = sessionStorage.getItem('feedActiveAfterDelete')
    if (nextFromDelete && items.some((item) => item.id === nextFromDelete)) {
      setActiveItemId(nextFromDelete)
      pendingActiveRestoreRef.current = nextFromDelete
      return
    }
    const nextFromBack = sessionStorage.getItem('feedActiveAfterBack')
    if (nextFromBack && items.some((item) => item.id === nextFromBack)) {
      setActiveItemId(nextFromBack)
      pendingActiveRestoreRef.current = nextFromBack
      return
    }
    if (pendingActiveRestoreRef.current) {
      return
    }
    if (!activeItemId || !items.some((item) => item.id === activeItemId)) {
      setActiveItemId(items[0].id)
    }
  }, [items, activeItemId])

  useEffect(() => {
    if (!pendingActiveRestoreRef.current || !activeItemId) return
    if (pendingActiveRestoreRef.current !== activeItemId) return
    if (sessionStorage.getItem('feedActiveAfterDelete') === activeItemId) {
      sessionStorage.removeItem('feedActiveAfterDelete')
    }
    if (sessionStorage.getItem('feedActiveAfterBack') === activeItemId) {
      sessionStorage.removeItem('feedActiveAfterBack')
    }
    pendingActiveRestoreRef.current = null
  }, [activeItemId])

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
              window.scrollBy(0, -headerHeight - 8)
            }
          }
        }
        return
      }

      if (event.key.toLowerCase() === 'd' && activeItemId) {
        event.preventDefault()
        const currentIndex = items.findIndex((item) => item.id === activeItemId)
        const nextCandidate =
          currentIndex > -1 ? items[currentIndex + 1] ?? items[currentIndex - 1] : null
        if (nextCandidate?.id) {
          setActiveItemId(nextCandidate.id)
          sessionStorage.setItem('feedActiveAfterDelete', nextCandidate.id)
        }
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
          sessionStorage.setItem('feedScrollOverride', '1')
          sessionStorage.setItem('feedScrollY', String(window.scrollY))
          sessionStorage.setItem('feedRestoreKey', activeItemId)
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

  useEffect(() => {
    const target = loadMoreRef.current
    if (!target) return
    if (!hasNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          if (!hasNextPage || isFetchingNextPage) return
          void fetchNextPage()
        })
      },
      { rootMargin: '200px 0px', threshold: 0 }
    )
    observer.observe(target)
    return () => {
      observer.disconnect()
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

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
              isActive={activeItemId === item.id}
              onHover={() => setActiveItemId(item.id)}
            />
          ))}
          <div ref={loadMoreRef} className="h-8" />
          {isFetchingNextPage && (
            <div className="text-center py-6 text-gray-500">Loading...</div>
          )}
        </div>
      </main>
    </div>
  )
}

