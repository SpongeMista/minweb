'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { useToast } from '@/components/ui/use-toast'

interface FeedItemProps {
  item: {
    id: string
    source: 'substack' | 'youtube'
    sourceId?: string
    title: string
    author: string | null
    publishedAt: string
    excerpt: string | null
    emailText?: string | null
    url: string
    thumbnail: string | null
  }
  hideThumbnails?: boolean
  greyscaleThumbnails?: boolean
}

export default function FeedItem({
  item,
  hideThumbnails = false,
  greyscaleThumbnails = false,
}: FeedItemProps) {
  const timeAgo = formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })
  const isYoutube = item.source === 'youtube'
  const emailPreview = !isYoutube ? item.emailText || item.excerpt : item.excerpt
  const metaGrayClass = 'text-gray-400'
  const youtubeIconClass = greyscaleThumbnails ? metaGrayClass : 'text-red-500'
  const showThumbnail = !hideThumbnails && (item.thumbnail || !isYoutube)
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const restoreItem = async () => {
    if (!item.id) return
    const res = await fetch(`/api/feed/${item.id}`, { method: 'PATCH' })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to restore' }))
      throw new Error(error.error || 'Failed to restore')
    }
    queryClient.invalidateQueries({ queryKey: ['feed'] })
  }

  const deleteItem = async () => {
    if (!item.id || isDeleting) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/feed/${item.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to delete' }))
        throw new Error(error.error || 'Failed to delete')
      }
      const { dismiss } = toast({
        title: 'Item deleted',
        duration: 3000,
        action: (
          <button
            type="button"
            className="text-sm text-gray-700 underline underline-offset-2 hover:text-gray-900"
            onClick={async (event) => {
              event.preventDefault()
              try {
                await restoreItem()
              } catch (error) {
                toast({ title: 'Undo failed', description: String(error) })
              } finally {
                dismiss()
              }
            }}
          >
            Undo
          </button>
        ),
      })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    } catch (error) {
      toast({ title: 'Delete failed', description: String(error) })
    } finally {
      setIsDeleting(false)
      setConfirmOpen(false)
    }
  }

  const menu = (
    <div className="absolute right-3 top-3 z-10">
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="More options"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus:outline-none"
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle cx="12" cy="5" r="2.25" fill="currentColor" />
              <circle cx="12" cy="12" r="2.25" fill="currentColor" />
              <circle cx="12" cy="19" r="2.25" fill="currentColor" />
            </svg>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600"
            onSelect={(event) => {
              event.preventDefault()
              if (item.id) {
                setMenuOpen(false)
                setConfirmOpen(true)
              }
            }}
          >
            <span className="mr-2 inline-flex">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path
                  d="M4 7h16M9 7V4h6v3m-7 3v8m4-8v8m4-8v8M7 7l1 13a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-13"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  const confirmDialog = (
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete item</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove the item from your feed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={deleteItem} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
  const content = (
    <article className="bg-white rounded-[8px] p-5 w-full">
      <div className={`flex items-start ${showThumbnail ? 'gap-4' : ''}`}>
        {showThumbnail && (
          <div
            className={`flex-shrink-0 w-32 h-24 overflow-hidden rounded-[8px] flex items-center justify-center ${
              item.thumbnail ? 'bg-gray-100' : greyscaleThumbnails ? 'bg-gray-100' : 'bg-[#FFF7CC]'
            } ${greyscaleThumbnails ? 'grayscale' : ''}`}
          >
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
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <rect
                  x="3"
                  y="5"
                  width="18"
                  height="14"
                  rx="2"
                  stroke={greyscaleThumbnails ? '#9CA3AF' : '#FFCE73'}
                  strokeWidth="1.5"
                />
                <path
                  d="M3 7l9 6 9-6"
                  stroke={greyscaleThumbnails ? '#9CA3AF' : '#FFCE73'}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isYoutube ? (
              <span className={`inline-flex items-center ${youtubeIconClass}`}>
                <svg
                  width="22"
                  height="16"
                  viewBox="0 0 22 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <rect width="22" height="16" rx="4" fill="currentColor" />
                  <path d="M8.5 4.5L15 8L8.5 11.5V4.5Z" fill="#FFFFFF" />
                </svg>
              </span>
            ) : (
              <span
                className={`inline-flex items-center ${
                  greyscaleThumbnails ? metaGrayClass : 'text-[#FFCE73]'
                }`}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            )}
            {item.author && (
              <span className="text-sm text-gray-600">{item.author}</span>
            )}
            <span className={`text-xs ${metaGrayClass}`}>·</span>
            <span className={`text-xs ${metaGrayClass}`}>{timeAgo}</span>
          </div>
          <h3 className="text-lg font-semibold mb-2 leading-snug line-clamp-2">
            {item.title}
          </h3>
          {emailPreview && (
            <p className="text-sm text-gray-600 line-clamp-2">{emailPreview}</p>
          )}
        </div>
      </div>
    </article>
  )

  if (isYoutube) {
    return (
      <div className="relative" data-feed-item-id={item.id}>
        {menu}
        {confirmDialog}
        <Link
          href={`/youtube/${item.id}`}
          className="block no-underline"
          onClick={() => {
            sessionStorage.setItem('feedScrollOverride', '1')
            sessionStorage.setItem('feedScrollY', String(window.scrollY))
            sessionStorage.setItem('feedRestoreKey', item.id)
          }}
        >
          {content}
        </Link>
      </div>
    )
  }

  if (!item.id) {
    return (
      <div className="relative">
        {menu}
        {confirmDialog}
        <div>{content}</div>
      </div>
    )
  }

  return (
    <div className="relative" data-feed-item-id={item.id}>
      {menu}
      {confirmDialog}
      <Link
        href={`/email/${item.id}`}
        className="block no-underline"
        onClick={() => {
          sessionStorage.setItem('feedScrollOverride', '1')
          sessionStorage.setItem('feedScrollY', String(window.scrollY))
          sessionStorage.setItem('feedRestoreKey', item.id)
        }}
      >
        {content}
      </Link>
    </div>
  )
}

