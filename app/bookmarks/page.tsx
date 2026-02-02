'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { MouseEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import FeedItem from '@/components/FeedItem'
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

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    const refreshStamp = sessionStorage.getItem('bookmarksRefreshStamp')
    if (!refreshStamp) return
    refetch()
    sessionStorage.removeItem('bookmarksRefreshStamp')
  }, [refetch])

  const handleBackClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push('/')
    }
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
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No bookmarks yet.</p>
        )}
      </main>
    </div>
  )
}
