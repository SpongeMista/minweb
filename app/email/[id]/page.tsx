'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

type EmailItem = {
  id: string
  title: string
  author: string | null
  publishedAt: string
  excerpt: string | null
  emailHtml?: string | null
  emailText?: string | null
}

export default function EmailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [item, setItem] = useState<EmailItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
  }, [id])

  useEffect(() => {
    const fetchItem = async () => {
      if (!id) {
        setIsLoading(false)
        setHasError(true)
        return
      }
      setIsLoading(true)
      setHasError(false)
      try {
        const res = await fetch(`/api/email/${id}`)
        if (!res.ok) {
          throw new Error('Failed to fetch email item')
        }
        const data = await res.json()
        setItem(data.item || null)
      } catch (error) {
        setHasError(true)
      } finally {
        setIsLoading(false)
      }
    }

    fetchItem()
  }, [id])

  useEffect(() => {
    if (id) {
      window.scrollTo(0, 0)
    }
  }, [id])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F5]">
        <main className="max-w-[648px] mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-full bg-gray-100" />
            <div>
              <div className="h-6 w-56 bg-gray-100 rounded" />
              <div className="mt-2 h-4 w-40 bg-gray-100 rounded" />
            </div>
          </div>
          <div className="bg-white rounded-[8px] p-5">
            <div className="h-4 w-1/2 bg-gray-100 rounded" />
            <div className="mt-2 h-4 w-5/6 bg-gray-100 rounded" />
            <div className="mt-2 h-4 w-2/3 bg-gray-100 rounded" />
            <div className="mt-6 h-4 w-3/4 bg-gray-100 rounded" />
            <div className="mt-2 h-4 w-1/2 bg-gray-100 rounded" />
          </div>
        </main>
      </div>
    )
  }

  if (hasError || !item) {
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
            <h1 className="text-2xl font-semibold text-black">Email</h1>
          </div>
          <div className="bg-white rounded-[8px] p-5">
            <p className="text-sm text-gray-600">
              This email could not be loaded. It may have been removed or the link is invalid.
            </p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <main className="max-w-[648px] mx-auto px-4 py-8">
        <div className="flex items-start gap-3 mb-4">
          <Link
            href="/"
            aria-label="Back to Feed"
            className="text-gray-600 hover:text-black transition-colors pt-1"
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
          <div>
            <h1 className="text-2xl font-semibold text-black">{item.title}</h1>
            <div className="text-sm text-gray-600 mt-2">
              {item.author && <span>{item.author}</span>}
              {item.author && <span className="mx-2 text-gray-400">·</span>}
              <span>{new Date(item.publishedAt).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <article className="bg-white rounded-[8px] p-5">
          {item.emailHtml ? (
            <div
              className="prose prose-sm max-w-none text-gray-700"
              dangerouslySetInnerHTML={{ __html: item.emailHtml }}
            />
          ) : item.emailText ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.emailText}</p>
          ) : item.excerpt ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.excerpt}</p>
          ) : (
            <p className="text-sm text-gray-500">
              This email did not include a readable body. Only the subject was available.
            </p>
          )}
        </article>
      </main>
    </div>
  )
}
