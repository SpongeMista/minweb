'use client'

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import FeedItem from '@/components/FeedItem'
import Link from 'next/link'

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

export default function FeedPage() {
  const queryClient = useQueryClient()

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
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

  // Auto-sync on page load
  useEffect(() => {
    syncFeeds()
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['feed'] })
        refetch()
      })
      .catch((error) => {
        console.error('Sync error:', error)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <header className="border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-light text-black">Minimal Web</h1>
          <Link
            href="/settings"
            aria-label="Settings"
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
                d="M19.4 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a7.03 7.03 0 0 0-1.63-.94l-.38-2.65a.5.5 0 0 0-.5-.42h-4a.5.5 0 0 0-.5.42l-.38 2.65c-.58.23-1.12.54-1.63.94l-2.49-1a.5.5 0 0 0-.6.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.04.31-.06.63-.06.94s.02.63.06.94L2.12 14.6a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .6.22l2.49-1c.5.4 1.05.71 1.63.94l.38 2.65a.5.5 0 0 0 .5.42h4a.5.5 0 0 0 .5-.42l.38-2.65c.58-.23 1.12-.54 1.63-.94l2.49 1a.5.5 0 0 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.66ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
                fill="currentColor"
              />
            </svg>
          </Link>
        </div>
      </header>

      <main className="max-w-[648px] mx-auto px-4 py-8">
        <div className="space-y-4">
          {items.length === 0 && !isFetchingNextPage && (
            <div className="text-center py-12 text-gray-500">
              <p>No items in feed yet.</p>
              <p className="mt-2 text-sm">
                Add Substack newsletters or connect YouTube to get started.
              </p>
            </div>
          )}

          {items.map((item: any) => (
            <FeedItem key={item.id} item={item} />
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

