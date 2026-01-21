'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

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

async function updateSettings(data: { hideYoutubeShorts: boolean }) {
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
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [hideYoutubeShorts, setHideYoutubeShorts] = useState(false)
  const [isEmailCopied, setIsEmailCopied] = useState(false)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { data: youtubeStatus, refetch: refetchYouTubeStatus } = useQuery({
    queryKey: ['youtube-status'],
    queryFn: fetchYouTubeStatus,
  })

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  })

  useEffect(() => {
    if (settingsData?.hideYoutubeShorts !== undefined) {
      setHideYoutubeShorts(settingsData.hideYoutubeShorts)
    }
  }, [settingsData])

  const updateSettingsMutation = useMutation({
    mutationFn: updateSettings,
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

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <main className="max-w-[648px] mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/"
            aria-label="Back to Feed"
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
            <div className="bg-white rounded-[26px] p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">YouTube</h2>
                {youtubeStatus?.connected && (
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
                )}
              </div>
              {youtubeStatus?.connected ? (
                <>
                  <p className="text-sm text-gray-600 mb-2">
                    Connected to YouTube
                  </p>
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
                  <a
                    href="/api/auth/signin/google?callbackUrl=/settings"
                    className="inline-block px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Connect with Google
                  </a>
                </>
              )}

              <div className="my-4 h-px bg-gray-200" />

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Hide YouTube Shorts</span>
                <button
                  type="button"
                  onClick={() => {
                    const nextValue = !hideYoutubeShorts
                    setHideYoutubeShorts(nextValue)
                    updateSettingsMutation.mutate({ hideYoutubeShorts: nextValue })
                  }}
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
            </div>
          </section>

          {/* Email Newsletters */}
          <section>
            <div className="bg-white rounded-[26px] p-5">
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

