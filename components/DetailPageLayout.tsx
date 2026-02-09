'use client'

import type { ReactNode } from 'react'
import NotesPanelSidebar from '@/components/NotesPanelSidebar'
import { useNotesDrawer } from '@/components/NotesDrawerContext'

export default function DetailPageLayout({ children }: { children: ReactNode }) {
  const notesDrawer = useNotesDrawer()
  const isOpen = notesDrawer?.isOpen ?? false
  const feedItemId = notesDrawer?.feedItemId ?? null

  return (
    <div className="flex h-full min-h-0 bg-[#F5F5F5] overflow-hidden">
      <div className="flex-1 min-w-0 min-h-0 overflow-y-auto">{children}</div>
      {isOpen && feedItemId && (
        <aside className="w-[320px] flex-shrink-0 border-l border-gray-200 bg-[#F5F5F5] flex flex-col h-full min-h-0 overflow-hidden">
          <NotesPanelSidebar feedItemId={feedItemId} />
        </aside>
      )}
    </div>
  )
}
