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

async function fetchRedditStatus() {
  const res = await fetch('/api/reddit/status')
  if (!res.ok) throw new Error('Failed to fetch Reddit status')
  return res.json()
}

async function fetchRedditSubreddits() {
  const res = await fetch('/api/reddit/subreddits')
  if (!res.ok) throw new Error('Failed to fetch Reddit subreddits')
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

async function addRedditSubreddit(payload: {
  subreddit: string
  title: string
  icon?: string | null
  sort?: 'new' | 'hot' | 'top'
}) {
  const res = await fetch('/api/reddit/subreddits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to add subreddit' }))
    throw new Error(error.error || 'Failed to add subreddit')
  }
  return res.json()
}

async function removeRedditSubreddit(payload: { subreddit: string }) {
  const res = await fetch('/api/reddit/subreddits', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to remove subreddit' }))
    throw new Error(error.error || 'Failed to remove subreddit')
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

async function fetchEmailSenders() {
  const res = await fetch('/api/settings/email-senders')
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to fetch email senders' }))
    throw new Error(error.error || 'Failed to fetch email senders')
  }
  return res.json()
}

async function updateEmailSenderStatus(payload: { email: string; status: 'allowed' | 'blocked' }) {
  const res = await fetch('/api/settings/email-senders', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to update sender status' }))
    throw new Error(error.error || 'Failed to update sender status')
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

function RedditLogoIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <circle cx="9" cy="11" r="1.2" fill="#FFFFFF" />
      <circle cx="15" cy="11" r="1.2" fill="#FFFFFF" />
      <path
        d="M8.5 14.5c1.4 1.1 5.6 1.1 7 0"
        stroke="#FFFFFF"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="17.3" cy="7.2" r="1.2" fill="#FFFFFF" />
      <path
        d="M12.5 6.8l3-0.9"
        stroke="#FFFFFF"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
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

function RedditSubredditThumbnail({
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
        <RedditLogoIcon className="h-4 w-4 text-orange-500" />
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

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-black' : 'bg-gray-300'
      } disabled:cursor-not-allowed disabled:opacity-50`}
      aria-label={ariaLabel}
      aria-pressed={checked}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
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
  const [redditQuery, setRedditQuery] = useState('')
  const [isRedditSearchOpen, setIsRedditSearchOpen] = useState(false)
  const [redditResults, setRedditResults] = useState<
    { subreddit: string; title: string; icon: string | null }[]
  >([])
  const [redditHighlightedIndex, setRedditHighlightedIndex] = useState(-1)
  const [isRedditSearching, setIsRedditSearching] = useState(false)
  const [redditSearchError, setRedditSearchError] = useState<string | null>(null)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchContainerRef = useRef<HTMLDivElement | null>(null)
  const redditSearchContainerRef = useRef<HTMLDivElement | null>(null)
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
  const { data: redditStatus } = useQuery({
    queryKey: ['reddit-status'],
    queryFn: fetchRedditStatus,
  })
  const {
    data: redditSubredditsData,
    isLoading: isRedditSubredditsLoading,
  } = useQuery({
    queryKey: ['reddit-subreddits'],
    queryFn: fetchRedditSubreddits,
  })

  const addChannelMutation = useMutation({
    mutationFn: addYoutubeChannel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube-channels'] })
      queryClient.invalidateQueries({ queryKey: ['youtube-status'] })
      sessionStorage.setItem('settingsChangeStamp', String(Date.now()))
    },
  })

  const removeChannelMutation = useMutation({
    mutationFn: removeYoutubeChannel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube-channels'] })
      queryClient.invalidateQueries({ queryKey: ['youtube-status'] })
      sessionStorage.setItem('settingsChangeStamp', String(Date.now()))
    },
  })

  const addSubredditMutation = useMutation({
    mutationFn: addRedditSubreddit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reddit-subreddits'] })
      queryClient.invalidateQueries({ queryKey: ['reddit-status'] })
      sessionStorage.setItem('settingsChangeStamp', String(Date.now()))
    },
  })

  const removeSubredditMutation = useMutation({
    mutationFn: removeRedditSubreddit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reddit-subreddits'] })
      queryClient.invalidateQueries({ queryKey: ['reddit-status'] })
      sessionStorage.setItem('settingsChangeStamp', String(Date.now()))
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

  const navigateBack = () => {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push('/')
    }
  }

  const { data: emailData, error: emailError, isLoading: isEmailLoading } = useQuery({
    queryKey: ['substack-email'],
    queryFn: fetchEmailAddress,
  })
  const {
    data: emailSendersData,
    isLoading: isEmailSendersLoading,
  } = useQuery({
    queryKey: ['email-senders'],
    queryFn: fetchEmailSenders,
  })

  const updateEmailSenderMutation = useMutation({
    mutationFn: updateEmailSenderStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-senders'] })
    },
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
      if (
        redditSearchContainerRef.current &&
        !redditSearchContainerRef.current.contains(target)
      ) {
        setIsRedditSearchOpen(false)
        setRedditResults([])
        setRedditHighlightedIndex(-1)
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
  const redditSubreddits: {
    subreddit: string
    title: string
    icon?: string | null
    sort?: 'new' | 'hot' | 'top'
  }[] = redditSubredditsData?.subreddits ?? []
  const allowedEmailSenders: {
    email: string
    name?: string | null
    status: 'allowed' | 'blocked'
  }[] = emailSendersData?.allowed ?? []
  const blockedEmailSenders: {
    email: string
    name?: string | null
    status: 'allowed' | 'blocked'
  }[] = emailSendersData?.blocked ?? []

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

  useEffect(() => {
    const query = redditQuery.trim()
    if (query.length < 2) {
      setIsRedditSearchOpen(false)
      setRedditResults([])
      setRedditHighlightedIndex(-1)
      setRedditSearchError(null)
      setIsRedditSearching(false)
      return
    }

    setIsRedditSearchOpen(true)
    setIsRedditSearching(true)
    setRedditSearchError(null)
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/reddit/search?query=${encodeURIComponent(query)}`)
        if (!res.ok) {
          const error = await res.json().catch(() => ({ error: 'Search failed' }))
          throw new Error(error.error || 'Search failed')
        }
        const data = await res.json()
        const results = data.results || []
        setRedditResults(results)
        setRedditHighlightedIndex(results.length > 0 ? 0 : -1)
      } catch (error) {
        setRedditSearchError(String(error))
      } finally {
        setIsRedditSearching(false)
      }
    }, 300)

    return () => clearTimeout(timeout)
  }, [redditQuery])


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
                  onSettled: navigateBack,
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
          {/* General */}
          <section>
            <div className="bg-white rounded-[8px] p-5">
              <h2 className="text-lg font-semibold mb-4">General</h2>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-600">View thumbnails</p>
                  <p className="text-xs text-gray-500 mt-1">
                    View thumbnails for all content on the feed.
                  </p>
                </div>
                <ToggleSwitch
                  checked={viewThumbnails}
                  onChange={() => {
                    const nextViewThumbnails = !viewThumbnails
                    const nextHideThumbnails = !nextViewThumbnails
                    setViewThumbnails(nextViewThumbnails)
                    writeHideThumbnailsPreference(nextHideThumbnails)
                    updateSettingsMutation.mutate({ hideThumbnails: nextHideThumbnails })
                  }}
                  ariaLabel="View thumbnails"
                />
              </div>
              <div className="mt-4 flex items-start justify-between gap-4 pl-0">
                <div>
                  <p className="text-sm text-gray-600">Greyscale mode</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Reduce distraction and excessive dopamine by switching everything on the app
                    to black and white.
                  </p>
                </div>
                <ToggleSwitch
                  checked={greyscaleThumbnails}
                  onChange={() => {
                    const nextValue = !greyscaleThumbnails
                    setGreyscaleThumbnails(nextValue)
                    updateSettingsMutation.mutate({ greyscaleThumbnails: nextValue })
                  }}
                  ariaLabel="Greyscale mode"
                />
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
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">Senders</p>
                  <span className="text-xs text-gray-500">
                    {allowedEmailSenders.length} sender
                    {allowedEmailSenders.length === 1 ? '' : 's'}
                  </span>
                </div>
                {isEmailSendersLoading ? (
                  <div className="h-4 w-40 bg-gray-100 rounded" />
                ) : allowedEmailSenders.length > 0 ? (
                  <div className="space-y-2">
                    {allowedEmailSenders.map((sender) => (
                      <div
                        key={sender.email}
                        className="flex items-center justify-between gap-3 border border-gray-200 rounded-[8px] px-3 py-2"
                      >
                        <div className="min-w-0">
                          <span className="text-sm text-gray-700 truncate block">
                            {sender.name || sender.email}
                          </span>
                          {sender.name && (
                            <span className="text-xs text-gray-500 truncate block">
                              {sender.email}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateEmailSenderMutation.mutate({
                              email: sender.email,
                              status: 'blocked',
                            })
                          }
                          disabled={updateEmailSenderMutation.isPending}
                          className="btn-remove px-3 py-1 border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm"
                        >
                          Block
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No senders yet.</p>
                )}
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">Blocked senders</p>
                  <span className="text-xs text-gray-500">
                    {blockedEmailSenders.length} blocked
                  </span>
                </div>
                {isEmailSendersLoading ? (
                  <div className="h-4 w-40 bg-gray-100 rounded" />
                ) : blockedEmailSenders.length > 0 ? (
                  <div className="space-y-2">
                    {blockedEmailSenders.map((sender) => (
                      <div
                        key={sender.email}
                        className="flex items-center justify-between gap-3 border border-gray-200 rounded-[8px] px-3 py-2"
                      >
                        <div className="min-w-0">
                          <span className="text-sm text-gray-700 truncate block">
                            {sender.name || sender.email}
                          </span>
                          {sender.name && (
                            <span className="text-xs text-gray-500 truncate block">
                              {sender.email}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateEmailSenderMutation.mutate({
                              email: sender.email,
                              status: 'allowed',
                            })
                          }
                          disabled={updateEmailSenderMutation.isPending}
                          className="px-3 py-1 border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm"
                        >
                          Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No blocked senders.</p>
                )}
              </div>
            </div>
          </section>

          {/* Reddit Connection */}
          <section>
            <div className="bg-white rounded-[8px] p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Reddit</h2>
                <span className="text-sm text-gray-500">
                  {redditSubreddits.length} subreddit{redditSubreddits.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Search and add public subreddits to sync into your feed.
              </p>
              <div className="relative" ref={redditSearchContainerRef}>
                <input
                  type="text"
                  value={redditQuery}
                  onChange={(event) => {
                    const nextQuery = event.target.value
                    setRedditQuery(nextQuery)
                    setIsRedditSearchOpen(nextQuery.trim().length >= 2)
                  }}
                  onKeyDown={(event) => {
                    if (redditResults.length === 0) return
                    if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      setRedditHighlightedIndex((prev) =>
                        prev < redditResults.length - 1 ? prev + 1 : 0
                      )
                    } else if (event.key === 'ArrowUp') {
                      event.preventDefault()
                      setRedditHighlightedIndex((prev) =>
                        prev > 0 ? prev - 1 : redditResults.length - 1
                      )
                    } else if (event.key === 'Enter') {
                      event.preventDefault()
                      const selected = redditResults[redditHighlightedIndex]
                      if (!selected) return
                      const alreadyAdded = redditSubreddits.some(
                        (subreddit) =>
                          subreddit.subreddit.toLowerCase() === selected.subreddit.toLowerCase()
                      )
                      if (alreadyAdded) return
                      addSubredditMutation.mutate({
                        subreddit: selected.subreddit,
                        title: selected.title,
                        icon: selected.icon,
                      })
                      setRedditQuery('')
                      setRedditResults([])
                      setRedditHighlightedIndex(-1)
                      setIsRedditSearchOpen(false)
                    } else if (event.key === 'Escape') {
                      setIsRedditSearchOpen(false)
                      setRedditResults([])
                      setRedditHighlightedIndex(-1)
                    }
                  }}
                  placeholder="Search subreddits"
                  className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
                />
                {isRedditSearchOpen &&
                  (isRedditSearching ||
                    redditResults.length > 0 ||
                    redditQuery.trim().length >= 2) && (
                    <div className="absolute z-10 mt-2 w-full rounded-[8px] border border-gray-200 bg-white shadow-sm">
                      {isRedditSearching ? (
                        <div className="px-3 py-2 text-sm text-gray-500">Searching...</div>
                      ) : redditResults.length > 0 ? (
                        <div className="max-h-64 overflow-y-auto">
                          {redditResults.map((result, index) => {
                            const alreadyAdded = redditSubreddits.some(
                              (subreddit) =>
                                subreddit.subreddit.toLowerCase() === result.subreddit.toLowerCase()
                            )
                            return (
                              <button
                                key={result.subreddit}
                                type="button"
                                onClick={() => {
                                  if (alreadyAdded) return
                                  addSubredditMutation.mutate({
                                    subreddit: result.subreddit,
                                    title: result.title,
                                    icon: result.icon,
                                  })
                                  setRedditQuery('')
                                  setRedditResults([])
                                  setRedditHighlightedIndex(-1)
                                  setIsRedditSearchOpen(false)
                                }}
                                disabled={alreadyAdded || addSubredditMutation.isPending}
                                className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 disabled:opacity-50 ${
                                  redditHighlightedIndex === index ? 'bg-gray-50' : ''
                                }`}
                              >
                                <RedditSubredditThumbnail
                                  src={result.icon}
                                  className="h-8 w-8 rounded-full object-cover"
                                />
                                <div className="min-w-0">
                                  <span className="text-sm text-gray-700 truncate block">
                                    r/{result.subreddit}
                                  </span>
                                  <span className="text-xs text-gray-500 truncate block">
                                    {result.title}
                                  </span>
                                </div>
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
              {redditSearchError && (
                <p className="text-xs text-red-600 mt-2">{redditSearchError}</p>
              )}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">Your subreddits</p>
                  {redditStatus?.lastSyncedAt && (
                    <p className="text-xs text-gray-500">
                      Last synced:{' '}
                      {new Date(redditStatus.lastSyncedAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  )}
                </div>
                {isRedditSubredditsLoading ? (
                  <div className="h-4 w-40 bg-gray-100 rounded" />
                ) : redditSubreddits.length > 0 ? (
                  <div className="space-y-2">
                    {redditSubreddits.map((subreddit) => (
                      <div
                        key={subreddit.subreddit}
                        className="flex items-center justify-between gap-3 border border-gray-200 rounded-[8px] px-3 py-2"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <RedditSubredditThumbnail
                            src={subreddit.icon}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                          <div className="min-w-0">
                            <span className="text-sm text-gray-700 truncate block">
                              r/{subreddit.subreddit}
                            </span>
                            <span className="text-xs text-gray-500 truncate block">
                              {subreddit.title}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">Sort by:</span>
                          <select
                            value={subreddit.sort ?? 'new'}
                            onChange={(event) => {
                              const nextValue = event.target.value as 'new' | 'hot' | 'top'
                              addSubredditMutation.mutate({
                                subreddit: subreddit.subreddit,
                                title: subreddit.title,
                                icon: subreddit.icon,
                                sort: nextValue,
                              })
                            }}
                            className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700"
                          >
                            <option value="new">New</option>
                            <option value="hot">Hot</option>
                            <option value="top">Top</option>
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              removeSubredditMutation.mutate({ subreddit: subreddit.subreddit })
                            }
                            disabled={removeSubredditMutation.isPending}
                            className="btn-remove px-3 py-1 border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No subreddits added yet.</p>
                )}
              </div>

            </div>
          </section>

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
                      Last synced:{' '}
                      {new Date(youtubeStatus.lastSyncedAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
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
                          className="btn-remove px-3 py-1 border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm"
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
                    <ToggleSwitch
                      checked={hideYoutubeShorts}
                      onChange={() => {
                        const nextValue = !hideYoutubeShorts
                        setHideYoutubeShorts(nextValue)
                        updateSettingsMutation.mutate({
                          hideYoutubeShorts: nextValue,
                          shortsMinSeconds,
                        })
                      }}
                      disabled={isYoutubeLoading}
                      ariaLabel="Hide YouTube Shorts"
                    />
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
        </div>
      </main>
    </div>
  )
}

