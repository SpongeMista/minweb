'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
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

export default function BookmarksPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: fetchBookmarks,
    refetchOnMount: 'always',
  })

  const items = data?.items ?? []
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

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <main className="max-w-[648px] mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-4">
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
                greyscaleThumbnails={false}
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
