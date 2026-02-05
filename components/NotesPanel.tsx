'use client'

import { useEffect, useRef, useState } from 'react'
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

type FeedItemNote = {
  id: string
  body: string
  createdAt: string
}

type NotesPanelProps = {
  feedItemId: string
}

export default function NotesPanel({ feedItemId }: NotesPanelProps) {
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState<FeedItemNote[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [noteBody, setNoteBody] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingBody, setEditingBody] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(new Set())
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FeedItemNote | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const ignoreNextEditBlurRef = useRef(false)
  const latestNotesRef = useRef<FeedItemNote[]>([])
  const latestActiveNoteIdRef = useRef<string | null>(null)

  const updateFeedCounts = (updater: (item: any) => any) => {
    queryClient.setQueryData(['feed'], (current: any) => {
      if (!current?.pages) return current
      const nextPages = current.pages.map((page: any) => ({
        ...page,
        items: Array.isArray(page.items)
          ? page.items.map((pageItem: any) =>
              pageItem?.id === feedItemId ? updater(pageItem) : pageItem
            )
          : page.items,
      }))
      return { ...current, pages: nextPages }
    })
  }

  const updateBookmarksCounts = (updater: (item: any) => any) => {
    queryClient.setQueryData(['bookmarks'], (current: any) => {
      if (!Array.isArray(current?.items)) return current
      return {
        ...current,
        items: current.items.map((bookmarkItem: any) =>
          bookmarkItem?.id === feedItemId ? updater(bookmarkItem) : bookmarkItem
        ),
      }
    })
  }

  const applyNotesDelta = (item: any, delta: number) => {
    const nextCount = Math.max(0, (item?.notesCount ?? 0) + delta)
    return {
      ...item,
      notesCount: nextCount,
    }
  }

  const loadNotes = async () => {
    if (!feedItemId) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/notes?feedItemId=${encodeURIComponent(feedItemId)}`)
      if (!res.ok) {
        throw new Error('Failed to fetch notes')
      }
      const data = await res.json()
      setNotes(Array.isArray(data?.notes) ? data.notes : [])
    } catch (err) {
      setError(String(err))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadNotes()
  }, [feedItemId])

  const resizeNoteTextarea = () => {
    const textarea = noteTextareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }

  const resizeEditTextarea = () => {
    const textarea = editTextareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }

  useEffect(() => {
    if (!isAdding) return
    requestAnimationFrame(() => {
      noteTextareaRef.current?.focus()
      resizeNoteTextarea()
    })
  }, [isAdding])

  useEffect(() => {
    if (notes.length === 0) {
      if (activeNoteId !== null) {
        setActiveNoteId(null)
      }
      return
    }
    if (!activeNoteId || !notes.some((note) => note.id === activeNoteId)) {
      setActiveNoteId(notes[0].id)
    }
  }, [notes, activeNoteId])

  useEffect(() => {
    latestNotesRef.current = notes
    latestActiveNoteIdRef.current = activeNoteId
  }, [notes, activeNoteId])

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      return target.isContentEditable
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const currentNotes = latestNotesRef.current
      const currentActiveNoteId = latestActiveNoteIdRef.current
      if (isEditableTarget(event.target)) return
      if (event.key.toLowerCase() === 'n' && event.shiftKey) {
        event.preventDefault()
        setIsAdding(true)
        return
      }
      if (event.key === 'Enter' && currentActiveNoteId) {
        event.preventDefault()
        const targetNote =
          currentNotes.find((note) => note.id === currentActiveNoteId) ?? null
        if (targetNote) {
          startEditing(targetNote)
        }
        return
      }
      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        currentActiveNoteId
      ) {
        event.preventDefault()
        const targetNote =
          currentNotes.find((note) => note.id === currentActiveNoteId) ?? null
        if (targetNote) {
          setDeleteTarget(targetNote)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    if (!editingNoteId) return
    requestAnimationFrame(() => {
      const textarea = editTextareaRef.current
      if (!textarea) return
      textarea.focus()
      resizeEditTextarea()
      const length = textarea.value.length
      textarea.setSelectionRange(length, length)
    })
  }, [editingNoteId])

  const saveNote = async () => {
    if (isCreating || !noteBody.trim()) return
    setIsCreating(true)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedItemId, body: noteBody.trim() }),
      })
      if (!res.ok) {
        throw new Error('Failed to save note')
      }
      const data = await res.json()
      if (data?.note) {
        setNotes((prev) => [data.note as FeedItemNote, ...prev])
        updateFeedCounts((item) => applyNotesDelta(item, 1))
        updateBookmarksCounts((item) => applyNotesDelta(item, 1))
      } else {
        await loadNotes()
      }
      setNoteBody('')
      setIsAdding(false)
    } catch (err) {
      setError(String(err))
    } finally {
      setIsCreating(false)
    }
  }

  const startEditing = (note: FeedItemNote) => {
    ignoreNextEditBlurRef.current = true
    setEditingNoteId(note.id)
    setEditingBody(note.body)
    setError(null)
  }

  const cancelEditing = () => {
    setEditingNoteId(null)
    setEditingBody('')
  }

  const saveEdit = async () => {
    if (!editingNoteId) return
    const trimmedBody = editingBody.trim()
    if (!trimmedBody) {
      setError('Note cannot be empty.')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingNoteId, body: trimmedBody }),
      })
      if (!res.ok) {
        throw new Error('Failed to update note')
      }
      const data = await res.json()
      if (data?.note) {
        setNotes((prev) =>
          prev.map((note) =>
            note.id === data.note.id ? (data.note as FeedItemNote) : note
          )
        )
      } else {
        await loadNotes()
      }
      cancelEditing()
    } catch (err) {
      setError(String(err))
    } finally {
      setIsSaving(false)
    }
  }

  const isLongNote = (note: FeedItemNote) => {
    if (note.body.split('\n').length > 3) return true
    return note.body.length > 240
  }

  const deleteNote = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    setError(null)
    try {
      const res = await fetch('/api/notes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id }),
      })
      if (!res.ok) {
        throw new Error('Failed to delete note')
      }
      if (editingNoteId === deleteTarget.id) {
        cancelEditing()
      }
      setNotes((prev) => prev.filter((note) => note.id !== deleteTarget.id))
      updateFeedCounts((item) => applyNotesDelta(item, -1))
      updateBookmarksCounts((item) => applyNotesDelta(item, -1))
      setExpandedNoteIds((prev) => {
        if (!prev.has(deleteTarget.id)) return prev
        const next = new Set(prev)
        next.delete(deleteTarget.id)
        return next
      })
      setDeleteTarget(null)
    } catch (err) {
      setError(String(err))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="bg-white rounded-[8px] px-5 pt-3 pb-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold text-black">Notes</h2>
        <span className="text-sm text-gray-400">{notes.length} notes</span>
      </div>
      <button
        type="button"
        className="w-full mb-4 h-10 rounded-[8px] border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-4 px-4"
        onClick={() => setIsAdding(true)}
      >
        <span>+ Add a new note</span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-500">
            ⇧
          </span>
          <span className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-500">
            N
          </span>
        </span>
      </button>

      {isAdding && (
        <div className="mb-4">
          <textarea
            ref={noteTextareaRef}
            value={noteBody}
            onChange={(event) => {
              setNoteBody(event.target.value)
              resizeNoteTextarea()
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void saveNote()
              }
            }}
            onBlur={() => {
              if (noteBody.trim()) {
                void saveNote()
              } else {
                setNoteBody('')
                setIsAdding(false)
              }
            }}
            rows={1}
            className="w-full border border-gray-300 rounded-[8px] p-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none overflow-hidden"
            placeholder="Write your note..."
          />
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 mb-3">
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <div className="h-4 bg-gray-100 rounded" />
          <div className="h-4 bg-gray-100 rounded w-5/6" />
        </div>
      ) : notes.length > 0 ? (
        <div className="space-y-4">
          {notes.map((note) => {
            const isEditing = editingNoteId === note.id
            const isExpanded = expandedNoteIds.has(note.id)
            const shouldTruncate = isLongNote(note) && !isExpanded
            const isActive = activeNoteId === note.id
            return (
              <div
                key={note.id}
                className="border border-gray-100 rounded-[8px] p-3 relative"
                onMouseEnter={() => setActiveNoteId(note.id)}
              >
                {isActive && (
                  <span
                    className="absolute left-0 top-0 h-full w-1 bg-black rounded-l-[8px]"
                    aria-hidden="true"
                  />
                )}
                <div className="absolute right-2 top-2">
                  <DropdownMenu
                    open={menuOpenId === note.id}
                    onOpenChange={(open) => setMenuOpenId(open ? note.id : null)}
                  >
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
                        onSelect={(event) => {
                          event.preventDefault()
                          setMenuOpenId(null)
                          startEditing(note)
                        }}
                      >
                        <span className="flex-1">Edit</span>
                        <span className="ml-2 inline-flex min-w-[32px] justify-center rounded border border-gray-200 px-1.5 py-0.5 text-[11px] text-gray-500">
                          Enter
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-600"
                        onSelect={(event) => {
                          event.preventDefault()
                          setMenuOpenId(null)
                          setDeleteTarget(note)
                        }}
                      >
                        <span className="flex-1">Delete</span>
                        <span className="ml-2 inline-flex min-w-[32px] justify-center rounded border border-gray-200 px-1.5 py-0.5 text-[11px] text-gray-500">
                          Del
                        </span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {isEditing ? (
                  <div className="pr-8">
                    <textarea
                      ref={editTextareaRef}
                      value={editingBody}
                      onChange={(event) => {
                        setEditingBody(event.target.value)
                        resizeEditTextarea()
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault()
                          void saveEdit()
                        }
                      }}
                      onBlur={() => {
                        if (ignoreNextEditBlurRef.current) {
                          ignoreNextEditBlurRef.current = false
                          return
                        }
                        if (editingBody.trim()) {
                          void saveEdit()
                        } else {
                          setError('Note cannot be empty.')
                        }
                      }}
                      rows={1}
                      className="w-full border border-gray-300 rounded-[8px] p-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none overflow-hidden"
                      disabled={isSaving}
                    />
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(note.createdAt).toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="w-full text-left pr-8"
                    onClick={() => {
                      if (isLongNote(note)) {
                        setExpandedNoteIds((prev) => {
                          const next = new Set(prev)
                          if (next.has(note.id)) {
                            next.delete(note.id)
                          } else {
                            next.add(note.id)
                          }
                          return next
                        })
                        return
                      }
                    }}
                  >
                    <p
                      className={`text-sm text-gray-700 whitespace-pre-wrap ${
                        shouldTruncate ? 'line-clamp-3' : ''
                      }`}
                    >
                      {note.body}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(note.createdAt).toLocaleString()}
                    </p>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ) : null}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete note</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteNote} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
