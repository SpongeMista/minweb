'use client'

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'

type NotesDrawerContextValue = {
  isOpen: boolean
  feedItemId: string | null
  notesCount: number
  setFeedItemId: (id: string | null) => void
  setNotesCount: (n: number) => void
  open: () => void
  close: () => void
  toggle: () => void
}

const NotesDrawerContext = createContext<NotesDrawerContextValue | null>(null)

export function NotesDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [feedItemId, setFeedItemIdState] = useState<string | null>(null)
  const [notesCount, setNotesCount] = useState(0)

  const setFeedItemId = useCallback((id: string | null) => {
    setFeedItemIdState(id)
    setNotesCount(0)
    if (!id) {
      setIsOpen(false)
    } else {
      setIsOpen(true)
    }
  }, [])

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])

  const value: NotesDrawerContextValue = {
    isOpen,
    feedItemId,
    notesCount,
    setFeedItemId,
    setNotesCount,
    open,
    close,
    toggle,
  }

  return (
    <NotesDrawerContext.Provider value={value}>
      {children}
    </NotesDrawerContext.Provider>
  )
}

export function useNotesDrawer(): NotesDrawerContextValue | null {
  return useContext(NotesDrawerContext)
}
