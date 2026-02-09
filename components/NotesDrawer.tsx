'use client'

import { useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import NotesPanel from '@/components/NotesPanel'
import { useNotesDrawer } from '@/components/NotesDrawerContext'

export default function NotesDrawer() {
  const { isOpen, close, feedItemId } = useNotesDrawer()

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, close])

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent side="right" className="flex flex-col p-0">
        <SheetHeader className="flex h-12 flex-row items-center justify-between border-b border-gray-200 px-4 py-3">
          <SheetTitle className="text-lg font-semibold">Notes</SheetTitle>
          <button
            type="button"
            aria-label="Close notes"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
            onClick={close}
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
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </SheetHeader>
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {feedItemId && (
            <NotesPanel feedItemId={feedItemId} embeddedInDrawer />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
