'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import FeedItem from '@/components/FeedItem'
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
import {
  readHideThumbnailsPreferenceSync,
  useHideThumbnailsPreference,
} from '@/lib/use-hide-thumbnails'

async function fetchBookmarks() {
  const res = await fetch('/api/bookmarks')
  if (!res.ok) throw new Error('Failed to fetch bookmarks')
  return res.json()
}

async function fetchSettings() {
  const res = await fetch('/api/settings')
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

export default function BookmarksPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: fetchBookmarks,
    refetchOnMount: 'always',
  })
  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const items = data?.items ?? []
  const greyscaleThumbnails = settingsData?.greyscaleThumbnails ?? false
  const initialHideThumbnails = readHideThumbnailsPreferenceSync()
  const [localHideThumbnails] = useHideThumbnailsPreference(initialHideThumbnails)
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    const refreshStamp = sessionStorage.getItem('bookmarksRefreshStamp')
    if (!refreshStamp) return
    refetch()
    sessionStorage.removeItem('bookmarksRefreshStamp')
  }, [refetch])

  useEffect(() => {
    if (items.length === 0) {
      if (activeItemId !== null) {
        setActiveItemId(null)
      }
      return
    }
    if (!activeItemId || !items.some((item: any) => item.id === activeItemId)) {
      setActiveItemId(items[0].id)
    }
  }, [items, activeItemId])

  useEffect(() => {
    const lastDeletedId = sessionStorage.getItem('lastDeletedId')
    const lastDeletedSource = sessionStorage.getItem('lastDeletedSource')
    if (!lastDeletedId || lastDeletedSource !== 'bookmarks-detail') return
    queryClient.setQueryData(['bookmarks'], (current: any) => {
      if (!Array.isArray(current?.items)) return current
      return {
        ...current,
        items: current.items.filter((bookmarkItem: any) => bookmarkItem?.id !== lastDeletedId),
      }
    })
    sessionStorage.removeItem('lastDeletedId')
    sessionStorage.removeItem('lastDeletedSource')
  }, [items, isLoading, queryClient])

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

      if (event.key.toLowerCase() === 'b') {
        if (activeItemId) {
          window.dispatchEvent(
            new CustomEvent('feed-item-bookmark', { detail: { id: activeItemId } })
          )
        }
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const currentIndex = items.findIndex((item: any) => item.id === activeItemId)
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

      if (event.key.toLowerCase() === 'd' && activeItemId) {
        event.preventDefault()
        setPendingDeleteId(activeItemId)
        setConfirmDeleteOpen(true)
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

  const handleBackClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <main className="max-w-[648px] mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/"
            aria-label="Back to Feed"
            className="text-gray-600 hover:text-black transition-colors"
            onClick={handleBackClick}
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
          <h1 className="text-2xl font-semibold text-black">Bookmarks</h1>
        </div>
        {isLoading ? (
          <div className="space-y-4">
            <div className="h-24 rounded-[8px] bg-white" />
            <div className="h-24 rounded-[8px] bg-white" />
          </div>
        ) : items.length > 0 ? (
          <div className="space-y-4">
            {items.map((item: any) => (
              <FeedItem
                key={item.id}
                item={item}
                hideThumbnails={localHideThumbnails ?? false}
                greyscaleThumbnails={greyscaleThumbnails}
                isBookmarksList
                isActive={activeItemId === item.id}
                onHover={() => setActiveItemId(item.id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No bookmarks yet.</p>
        )}
      </main>
      <AlertDialog
        open={confirmDeleteOpen}
        onOpenChange={(open) => {
          setConfirmDeleteOpen(open)
          if (!open) {
            setPendingDeleteId(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bookmark</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the item from your bookmarks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingDeleteId) return
                window.dispatchEvent(
                  new CustomEvent('feed-item-delete', { detail: { id: pendingDeleteId } })
                )
                setPendingDeleteId(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
