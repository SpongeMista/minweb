'use client'

import { useEffect } from 'react'
import NotesPanel from '@/components/NotesPanel'
import { useNotesDrawer } from '@/components/NotesDrawerContext'

type NotesPanelSidebarProps = {
  feedItemId: string
}

export default function NotesPanelSidebar({ feedItemId }: NotesPanelSidebarProps) {
  const { close } = useNotesDrawer() ?? {}

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close?.()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [close])

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F5F5F5]">
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <NotesPanel feedItemId={feedItemId} embeddedInDrawer />
      </div>
    </div>
  )
}
