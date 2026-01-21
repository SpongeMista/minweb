'use client'

import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

interface FeedItemProps {
  item: {
    id: string
    source: 'substack' | 'youtube'
    title: string
    author: string | null
    publishedAt: string
    excerpt: string | null
    url: string
    thumbnail: string | null
  }
}

export default function FeedItem({ item }: FeedItemProps) {
  const timeAgo = formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })
  const isYoutube = item.source === 'youtube'
  if (isYoutube && !item.url) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d522e45f-6553-41ae-9f89-ce175ebda76a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/FeedItem.tsx:9',message:'YouTube item missing URL',data:{id:item.id,source:item.source,title:item.title},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
  }
  const content = (
    <article className="bg-white rounded-[26px] p-5 w-full">
      <div className="flex gap-4 items-start">
        {(item.thumbnail || !isYoutube) && (
          <div className="flex-shrink-0 w-32 h-24 bg-gray-100 overflow-hidden rounded-[18px] flex items-center justify-center">
            {item.thumbnail ? (
              <img
                src={item.thumbnail}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Hide image on error
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              <span className="text-xs text-gray-400">Email</span>
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isYoutube ? (
              <span className="inline-flex items-center">
                <svg
                  width="22"
                  height="16"
                  viewBox="0 0 22 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <rect width="22" height="16" rx="4" fill="#FF0000" />
                  <path d="M8.5 4.5L15 8L8.5 11.5V4.5Z" fill="white" />
                </svg>
              </span>
            ) : (
              <span className="text-sm">📰</span>
            )}
            {item.author && (
              <span className="text-sm text-gray-600">{item.author}</span>
            )}
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-400">{timeAgo}</span>
          </div>
          <h3 className="text-lg font-semibold mb-2 leading-snug line-clamp-2">
            {item.title}
          </h3>
          {item.excerpt && (
            <p className="text-sm text-gray-600 line-clamp-2">{item.excerpt}</p>
          )}
        </div>
      </div>
    </article>
  )

  if (isYoutube) {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {content}
      </a>
    )
  }

  return (
    <Link href={`/email/${item.id}`} className="block">
      {content}
    </Link>
  )
}

