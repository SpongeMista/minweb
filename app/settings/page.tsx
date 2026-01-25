'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  readHideThumbnailsPreference,
  writeHideThumbnailsPreference,
} from '@/lib/use-hide-thumbnails'

async function fetchYouTubeStatus() {
  const res = await fetch('/api/youtube/status')
  if (!res.ok) throw new Error('Failed to fetch YouTube status')
  return res.json()
}

async function fetchYoutubeChannels() {
  const res = await fetch('/api/youtube/channels')
  if (!res.ok) throw new Error('Failed to fetch YouTube channels')
  return res.json()
}

async function addYoutubeChannel(payload: {
  channelId: string
  channelTitle: string
  thumbnail?: string | null
}) {
  const res = await fetch('/api/youtube/channels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to add channel' }))
    throw new Error(error.error || 'Failed to add channel')
  }
  return res.json()
}

async function removeYoutubeChannel(payload: { channelId: string }) {
  const res = await fetch('/api/youtube/channels', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to remove channel' }))
    throw new Error(error.error || 'Failed to remove channel')
  }
  return res.json()
}

async function fetchSettings() {
  const res = await fetch('/api/settings')
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

async function updateSettings(data: {
  hideYoutubeShorts?: boolean
  shortsMinSeconds?: number
  hideThumbnails?: boolean
  greyscaleThumbnails?: boolean
}) {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to update settings' }))
    throw new Error(error.error || 'Failed to update settings')
  }
  return res.json()
}

async function fetchEmailAddress() {
  const res = await fetch('/api/substack/email')
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to fetch email address' }))
    throw new Error(error.error || 'Failed to fetch email address')
  }
  return res.json()
}

function YoutubeLogoIcon({ className }: { className?: string }) {
  return (
    <svg
      width="22"
      height="16"
      viewBox="0 0 22 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <rect width="22" height="16" rx="4" fill="currentColor" />
      <path d="M8.5 4.5L15 8L8.5 11.5V4.5Z" fill="#FFFFFF" />
    </svg>
  )
}

function YoutubeChannelThumbnail({
  src,
  className,
}: {
  src?: string | null
  className?: string
}) {
  const [hasError, setHasError] = useState(false)
  if (!src || hasError) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-gray-100 ${className ?? ''}`}
        aria-hidden="true"
      >
        <YoutubeLogoIcon className="h-4 w-4 text-red-500" />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt=""
      className={className}
      onError={() => setHasError(true)}
    />
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [hideYoutubeShorts, setHideYoutubeShorts] = useState(false)
  const [shortsMinSeconds, setShortsMinSeconds] = useState(60)
  const [viewThumbnails, setViewThumbnails] = useState(true)
  const [greyscaleThumbnails, setGreyscaleThumbnails] = useState(false)
  const [isEmailCopied, setIsEmailCopied] = useState(false)
  const [youtubeQuery, setYoutubeQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<
    { channelId: string; channelTitle: string; thumbnail: string | null }[]
  >([])
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchContainerRef = useRef<HTMLDivElement | null>(null)
  const {
    data: youtubeStatus,
    isLoading: isYoutubeLoading,
  } = useQuery({
    queryKey: ['youtube-status'],
    queryFn: fetchYouTubeStatus,
  })
  const {
    data: youtubeChannelsData,
    isLoading: isYoutubeChannelsLoading,
  } = useQuery({
    queryKey: ['youtube-channels'],
    queryFn: fetchYoutubeChannels,
  })

  const addChannelMutation = useMutation({
    mutationFn: addYoutubeChannel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube-channels'] })
      queryClient.invalidateQueries({ queryKey: ['youtube-status'] })
    },
  })

  const removeChannelMutation = useMutation({
    mutationFn: removeYoutubeChannel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube-channels'] })
      queryClient.invalidateQueries({ queryKey: ['youtube-status'] })
    },
  })

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  useEffect(() => {
    if (settingsData?.hideYoutubeShorts !== undefined) {
      setHideYoutubeShorts(settingsData.hideYoutubeShorts)
    }
    if (settingsData?.shortsMinSeconds !== undefined) {
      setShortsMinSeconds(settingsData.shortsMinSeconds)
    }
    if (settingsData?.hideThumbnails !== undefined) {
      setViewThumbnails(!settingsData.hideThumbnails)
      writeHideThumbnailsPreference(settingsData.hideThumbnails)
    }
    if (settingsData?.greyscaleThumbnails !== undefined) {
      setGreyscaleThumbnails(settingsData.greyscaleThumbnails)
    }
  }, [settingsData])

  useEffect(() => {
    const stored = readHideThumbnailsPreference()
    if (stored !== null) {
      setViewThumbnails(!stored)
    }
  }, [])

  const updateSettingsMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], (prev: any) => ({
        ...(prev ?? {}),
        ...(data ?? {}),
      }))
    },
  })

  const { data: emailData, error: emailError, isLoading: isEmailLoading } = useQuery({
    queryKey: ['substack-email'],
    queryFn: fetchEmailAddress,
  })

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setIsEmailCopied(true)
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
      copyTimeoutRef.current = setTimeout(() => {
        setIsEmailCopied(false)
      }, 1200)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setIsSearchOpen(false)
        setSearchResults([])
        setHighlightedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [])

  const youtubeChannels: {
    channelId: string
    channelTitle: string
    thumbnail?: string | null
  }[] = youtubeChannelsData?.channels ?? []

  useEffect(() => {
    const query = youtubeQuery.trim()
    if (query.length < 3) {
      setIsSearchOpen(false)
      setSearchResults([])
      setHighlightedIndex(-1)
      setSearchError(null)
      setIsSearching(false)
      return
    }

    setIsSearchOpen(true)
    setIsSearching(true)
    setSearchError(null)
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/youtube/search?query=${encodeURIComponent(query)}`)
        if (!res.ok) {
          const error = await res.json().catch(() => ({ error: 'Search failed' }))
          throw new Error(error.error || 'Search failed')
        }
        const data = await res.json()
        const results = data.results || []
        setSearchResults(results)
        setHighlightedIndex(results.length > 0 ? 0 : -1)
      } catch (error) {
        setSearchError(String(error))
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timeout)
  }, [youtubeQuery])


  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <main className="max-w-[648px] mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/"
            aria-label="Back to Feed"
            className="text-gray-600 hover:text-black transition-colors"
            onClick={(event) => {
              event.preventDefault()
              const changeStamp = Date.now()
              sessionStorage.setItem('settingsChangeStamp', String(changeStamp))
              const storedHideThumbnails = readHideThumbnailsPreference()
              const nextHideThumbnails =
                storedHideThumbnails !== null ? storedHideThumbnails : !viewThumbnails
              writeHideThumbnailsPreference(nextHideThumbnails)
              updateSettingsMutation.mutate(
                {
                  hideYoutubeShorts,
                  shortsMinSeconds,
                  hideThumbnails: nextHideThumbnails,
                  greyscaleThumbnails,
                },
                {
                  onSettled: () => router.push('/'),
                }
              )
            }}
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
          <h1 className="text-2xl font-semibold text-black">Settings</h1>
        </div>
        <div className="space-y-4">
          {/* YouTube Connection */}
          <section>
            <div className="bg-white rounded-[8px] p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">YouTube</h2>
                <span className="text-sm text-gray-500">
                  {youtubeChannels.length} channel{youtubeChannels.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Search and add YouTube channels to sync into your feed.
              </p>
              <div className="relative" ref={searchContainerRef}>
                <input
                  type="text"
                  value={youtubeQuery}
                  onChange={(event) => {
                    const nextQuery = event.target.value
                    setYoutubeQuery(nextQuery)
                    setIsSearchOpen(nextQuery.trim().length >= 3)
                  }}
                  onKeyDown={(event) => {
                    if (searchResults.length === 0) return
                    if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      setHighlightedIndex((prev) =>
                        prev < searchResults.length - 1 ? prev + 1 : 0
                      )
                    } else if (event.key === 'ArrowUp') {
                      event.preventDefault()
                      setHighlightedIndex((prev) =>
                        prev > 0 ? prev - 1 : searchResults.length - 1
                      )
                    } else if (event.key === 'Enter') {
                      event.preventDefault()
                      const selected = searchResults[highlightedIndex]
                      if (!selected) return
                      const alreadyAdded = youtubeChannels.some(
                        (channel) => channel.channelId === selected.channelId
                      )
                      if (alreadyAdded) return
                      addChannelMutation.mutate({
                        channelId: selected.channelId,
                        channelTitle: selected.channelTitle,
                        thumbnail: selected.thumbnail,
                      })
                      setYoutubeQuery('')
                      setSearchResults([])
                      setHighlightedIndex(-1)
                      setIsSearchOpen(false)
                    } else if (event.key === 'Escape') {
                      setIsSearchOpen(false)
                      setSearchResults([])
                      setHighlightedIndex(-1)
                    }
                  }}
                  placeholder="Search channels"
                  className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
                />
                {isSearchOpen &&
                  (isSearching || searchResults.length > 0 || youtubeQuery.trim().length >= 3) && (
                  <div className="absolute z-10 mt-2 w-full rounded-[8px] border border-gray-200 bg-white shadow-sm">
                    {isSearching ? (
                      <div className="px-3 py-2 text-sm text-gray-500">Searching...</div>
                    ) : searchResults.length > 0 ? (
                      <div className="max-h-64 overflow-y-auto">
                        {searchResults.map((result, index) => {
                          const alreadyAdded = youtubeChannels.some(
                            (channel) => channel.channelId === result.channelId
                          )
                          return (
                            <button
                              key={result.channelId}
                              type="button"
                              onClick={() => {
                                if (alreadyAdded) return
                                addChannelMutation.mutate({
                                  channelId: result.channelId,
                                  channelTitle: result.channelTitle,
                                  thumbnail: result.thumbnail,
                                })
                                setYoutubeQuery('')
                                setSearchResults([])
                                setHighlightedIndex(-1)
                              setIsSearchOpen(false)
                              }}
                              disabled={alreadyAdded || addChannelMutation.isPending}
                              className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 disabled:opacity-50 ${
                                highlightedIndex === index ? 'bg-gray-50' : ''
                              }`}
                            >
                            <YoutubeChannelThumbnail
                              src={result.thumbnail}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                              <span className="text-sm text-gray-700 truncate">
                                {result.channelTitle}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-500">No results.</div>
                    )}
                  </div>
                )}
              </div>
              {searchError && (
                <p className="text-xs text-red-600 mt-2">{searchError}</p>
              )}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">Your channels</p>
                  {youtubeStatus?.lastSyncedAt && (
                    <p className="text-xs text-gray-500">
                      Last synced: {new Date(youtubeStatus.lastSyncedAt).toLocaleString()}
                    </p>
                  )}
                </div>
                {isYoutubeChannelsLoading ? (
                  <div className="h-4 w-40 bg-gray-100 rounded" />
                ) : youtubeChannels.length > 0 ? (
                  <div className="space-y-2">
                    {youtubeChannels.map((channel) => (
                      <div
                        key={channel.channelId}
                        className="flex items-center justify-between gap-3 border border-gray-200 rounded-[8px] px-3 py-2"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <YoutubeChannelThumbnail
                            src={channel.thumbnail}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                          <span className="text-sm text-gray-700 truncate">
                            {channel.channelTitle}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            removeChannelMutation.mutate({ channelId: channel.channelId })
                          }
                          disabled={removeChannelMutation.isPending}
                          className="px-3 py-1 border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No channels added yet.</p>
                )}
              </div>

              {youtubeChannels.length > 0 && (
                <>
                  <div className="my-4 h-px bg-gray-200" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Hide YouTube Shorts</span>
                    <button
                      type="button"
                      onClick={() => {
                        const nextValue = !hideYoutubeShorts
                        setHideYoutubeShorts(nextValue)
                        updateSettingsMutation.mutate({
                          hideYoutubeShorts: nextValue,
                          shortsMinSeconds,
                        })
                      }}
                      disabled={isYoutubeLoading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        hideYoutubeShorts ? 'bg-black' : 'bg-gray-300'
                      }`}
                      aria-pressed={hideYoutubeShorts}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                          hideYoutubeShorts ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="mt-3 text-sm text-gray-600 flex items-center gap-2">
                    <span>Hide videos under</span>
                    <select
                      value={Math.max(1, Math.min(3, Math.round(shortsMinSeconds / 60)))}
                      onChange={(event) => {
                        const nextMinutes = Number(event.target.value)
                        if (!Number.isNaN(nextMinutes)) {
                          const nextSeconds = nextMinutes * 60
                          setShortsMinSeconds(nextSeconds)
                          if (hideYoutubeShorts) {
                            updateSettingsMutation.mutate({ shortsMinSeconds: nextSeconds })
                          }
                        }
                      }}
                      disabled={!hideYoutubeShorts}
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 disabled:opacity-50"
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                    </select>
                    <span>minutes.</span>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Feed */}
          <section>
            <div className="bg-white rounded-[8px] p-5">
              <h2 className="text-lg font-semibold mb-4">Feed</h2>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-600">View thumbnails</p>
                  <p className="text-xs text-gray-500 mt-1">
                    View thumbnails for all content on the feed.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextViewThumbnails = !viewThumbnails
                    const nextHideThumbnails = !nextViewThumbnails
                    setViewThumbnails(nextViewThumbnails)
                    writeHideThumbnailsPreference(nextHideThumbnails)
                    updateSettingsMutation.mutate({ hideThumbnails: nextHideThumbnails })
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    viewThumbnails ? 'bg-black' : 'bg-gray-300'
                  }`}
                  aria-label="View thumbnails"
                  aria-pressed={viewThumbnails}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      viewThumbnails ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-600">Greyscale thumbnails</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Turn thumbnails black and white to reduce distraction and excessive dopamine.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextValue = !greyscaleThumbnails
                    setGreyscaleThumbnails(nextValue)
                    updateSettingsMutation.mutate({ greyscaleThumbnails: nextValue })
                  }}
                  disabled={!viewThumbnails}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    greyscaleThumbnails ? 'bg-black' : 'bg-gray-300'
                  } ${viewThumbnails ? '' : 'cursor-not-allowed opacity-50'}`}
                  aria-label="Greyscale thumbnails"
                  aria-pressed={greyscaleThumbnails}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      greyscaleThumbnails ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* Email Newsletters */}
          <section>
            <div className="bg-white rounded-[8px] p-5">
              <h2 className="text-lg font-semibold mb-4">Email Newsletters</h2>
              <p className="text-sm text-gray-600 mb-4">
                Use this email that we have generated to subscribe to newsletters that you want to show up in your feed.
              </p>
              <div className="flex items-center gap-2">
                <code className="text-sm bg-gray-100 px-2 py-1 rounded border border-gray-300">
                  {isEmailLoading ? 'Loading...' : emailData?.email || 'Email not available'}
                </code>
                <button
                  onClick={() => {
                    if (emailData?.email) copyToClipboard(emailData.email)
                  }}
                  disabled={!emailData?.email}
                  className="px-3 py-1 min-w-[64px] border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm"
                >
                  {isEmailCopied ? '✓' : 'Copy'}
                </button>
              </div>
              {emailError && (
                <p className="text-xs text-red-600 mt-2">{String(emailError)}</p>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

