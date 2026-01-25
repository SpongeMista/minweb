'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import {
  readHideThumbnailsPreference,
  writeHideThumbnailsPreference,
} from '@/lib/use-hide-thumbnails'

async function fetchYouTubeStatus() {
  const res = await fetch('/api/youtube/status')
  if (!res.ok) throw new Error('Failed to fetch YouTube status')
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

async function disconnectYouTube() {
  const res = await fetch('/api/youtube/disconnect', {
    method: 'POST',
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to disconnect YouTube' }))
    throw new Error(error.error || 'Failed to disconnect YouTube')
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

export default function SettingsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [hideYoutubeShorts, setHideYoutubeShorts] = useState(false)
  const [shortsMinSeconds, setShortsMinSeconds] = useState(60)
  const [viewThumbnails, setViewThumbnails] = useState(true)
  const [greyscaleThumbnails, setGreyscaleThumbnails] = useState(false)
  const [isEmailCopied, setIsEmailCopied] = useState(false)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const {
    data: youtubeStatus,
    refetch: refetchYouTubeStatus,
    isLoading: isYoutubeLoading,
  } = useQuery({
    queryKey: ['youtube-status'],
    queryFn: fetchYouTubeStatus,
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

  // Check and associate accounts when component mounts or after OAuth
  useEffect(() => {
    // Trigger account association after a delay (to allow OAuth callback to complete)
    const timer = setTimeout(async () => {
      try {
        await fetch('/api/auth/associate-account', { method: 'POST' })
        refetchYouTubeStatus()
      } catch (error) {
        // Ignore errors
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [refetchYouTubeStatus])

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
                {youtubeStatus?.connected ? (
                  <button
                    onClick={async () => {
                      try {
                        setIsDisconnecting(true)
                        await disconnectYouTube()
                        refetchYouTubeStatus()
                      } catch (error) {
                        alert(String(error))
                      } finally {
                        setIsDisconnecting(false)
                      }
                    }}
                    disabled={isDisconnecting}
                    className="px-3 py-1 border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm"
                  >
                    {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => signIn('google', { callbackUrl: '/settings' })}
                    className="px-3 py-1 border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-sm"
                  >
                    Connect with Google
                  </button>
                )}
              </div>
              {isYoutubeLoading && !youtubeStatus ? (
                <>
                  <div className="h-4 w-40 bg-gray-100 rounded" />
                  <div className="h-3 w-32 bg-gray-100 rounded" />
                </>
              ) : youtubeStatus?.connected ? (
                <>
                  <div className="text-sm text-gray-600 mb-2">
                    <p>
                      Connected to{' '}
                      {youtubeStatus.channelName
                        ? `${youtubeStatus.channelName}'s`
                        : 'your'}{' '}
                      YouTube subscriptions.
                    </p>
                    <a
                      href="https://www.youtube.com/feed/channels"
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-gray-900 hover:underline"
                    >
                      Manage subscriptions
                    </a>
                  </div>
                  {youtubeStatus.lastSyncedAt && (
                    <p className="text-xs text-gray-500">
                      Last synced: {new Date(youtubeStatus.lastSyncedAt).toLocaleString()}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    Connect your YouTube account to sync subscriptions
                  </p>
                </>
              )}

              {youtubeStatus?.connected && (
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

