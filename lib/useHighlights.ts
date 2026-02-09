'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { applyHighlights, createRangeFromOffsets, getOffsetAtBoundary, getOffsetsFromRange, getStartTextBoundary } from '@/lib/highlight'

export type HighlightEntry = {
  id: string
  startOffset: number
  endOffset: number
  text: string
}

export function useHighlights(
  feedItemId: string | null,
  contentRef: React.RefObject<HTMLElement | null>,
  options?: { onHighlightCreated?: () => void }
) {
  const [highlights, setHighlights] = useState<HighlightEntry[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [hasSelectionInContent, setHasSelectionInContent] = useState(false)
  const highlightsRef = useRef<HighlightEntry[]>([])
  const onHighlightCreatedRef = useRef(options?.onHighlightCreated)
  onHighlightCreatedRef.current = options?.onHighlightCreated
  // Store character offset at mousedown so we don't depend on node identity after React re-renders.
  const startOffsetRef = useRef<number | null>(null)
  // Anchor (node, offset) for the drag so we can correct the selection on mousemove.
  const dragAnchorRef = useRef<{ node: Node; offset: number } | null>(null)

  const fetchHighlights = useCallback(async () => {
    if (!feedItemId) {
      setHighlights([])
      return
    }
    try {
      const res = await fetch(`/api/highlights?feedItemId=${encodeURIComponent(feedItemId)}`)
      if (!res.ok) return
      const data = await res.json()
      const list = Array.isArray(data?.highlights) ? data.highlights : []
      setHighlights(list)
      highlightsRef.current = list
    } catch {
      setHighlights([])
      highlightsRef.current = []
    }
  }, [feedItemId])

  useEffect(() => {
    void fetchHighlights()
  }, [fetchHighlights])

  useEffect(() => {
    const handleHighlightsChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ feedItemId: string }>).detail
      if (detail?.feedItemId === feedItemId) {
        void fetchHighlights()
      }
    }
    window.addEventListener('highlights-changed', handleHighlightsChanged)
    return () => window.removeEventListener('highlights-changed', handleHighlightsChanged)
  }, [feedItemId, fetchHighlights])

  const applyNow = useCallback(() => {
    const root = contentRef.current
    if (!root) return
    applyHighlights(root, highlightsRef.current)
  }, [])

  // useLayoutEffect so we apply before paint. Re-run on every commit so highlights survive parent re-renders that replace the article DOM.
  useLayoutEffect(() => {
    applyNow()
  })

  const createHighlightFromSelection = useCallback(async (): Promise<boolean> => {
    const root = contentRef.current
    if (!root || !feedItemId) return false
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return false
    const storedStartOffset = startOffsetRef.current
    startOffsetRef.current = null
    const focusNode = sel.focusNode
    const focusOffset = sel.focusOffset
    const selectedText = sel.toString().trim()
    let payload: { startOffset: number; endOffset: number; text: string } | null = null
    // Use stored character offset from mousedown so start is where user pressed (survives DOM replacement).
    if (
      storedStartOffset !== null &&
      focusNode &&
      root.contains(focusNode) &&
      selectedText.length > 0
    ) {
      const focusEndOffset = getOffsetAtBoundary(root, focusNode, focusOffset, 'end')
      if (focusEndOffset !== null && focusEndOffset !== storedStartOffset) {
        const start = Math.min(storedStartOffset, focusEndOffset)
        const end = Math.max(storedStartOffset, focusEndOffset)
        // Use root text slice for the note; selection at mouseup can span from doc start so sel.toString() would be wrong.
        const rootText = root.textContent ?? ''
        const text = rootText.slice(start, end)
        if (text.trim().length > 0) payload = { startOffset: start, endOffset: end, text }
      }
    }
    if (!payload) {
      const range = document.createRange()
      range.setStart(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset)
      range.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset)
      payload = getOffsetsFromRange(root, range)
    }
    if (!payload || !payload.text.trim()) return false

    setIsCreating(true)
    try {
      const res = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedItemId,
          startOffset: payload.startOffset,
          endOffset: payload.endOffset,
          text: payload.text.trim().slice(0, 5000),
        }),
      })
      if (!res.ok) return false
      const data = await res.json()
      const newHighlight = data?.highlight
      if (newHighlight) {
        const next = [...highlightsRef.current, newHighlight]
        setHighlights(next)
        highlightsRef.current = next
        // Defer apply so it runs after React commits; otherwise marks are applied then wiped by re-render.
        queueMicrotask(() => applyNow())
        sel.removeAllRanges()
        window.dispatchEvent(new CustomEvent('notes-changed', { detail: { feedItemId } }))
        onHighlightCreatedRef.current?.()
        return true
      }
      return false
    } finally {
      setIsCreating(false)
    }
  }, [feedItemId, contentRef, applyNow])

  const checkSelection = useCallback(() => {
    const root = contentRef.current
    if (!root) {
      setHasSelectionInContent(false)
      return
    }
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) {
      setHasSelectionInContent(false)
      return
    }
    const range = sel.getRangeAt(0)
    const text = range.toString().trim()
    setHasSelectionInContent(!!text && root.contains(range.commonAncestorContainer))
  }, [])

  useEffect(() => {
    const handleSelectionChange = () => {
      checkSelection()
    }
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [checkSelection])

  const createRef = useRef(createHighlightFromSelection)
  createRef.current = createHighlightFromSelection
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const root = contentRef.current
      if (!root || !root.contains(e.target as Node)) return
      // Use click position (not selection anchor) so we always get where the user pressed.
      let node: Node | null = null
      let offset = 0
      if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(e.clientX, e.clientY)
        if (pos && root.contains(pos.offsetNode)) {
          node = pos.offsetNode
          offset = pos.offset
        }
      }
      if ((!node || !root.contains(node)) && document.caretRangeFromPoint) {
        const range = document.caretRangeFromPoint(e.clientX, e.clientY)
        if (range && root.contains(range.startContainer)) {
          node = range.startContainer
          offset = range.startOffset
        }
      }
      if (!node && window.getSelection()?.anchorNode && root.contains(window.getSelection()!.anchorNode!)) {
        node = window.getSelection()!.anchorNode!
        offset = window.getSelection()!.anchorOffset
      }
      // Store character offset so it survives DOM replacement between mousedown and mouseup.
      const textBound =
        node?.nodeType === Node.TEXT_NODE ? { node: node as Text, offset } : node ? getStartTextBoundary(node, offset) : null
      if (textBound && root) {
        const startOffset = getOffsetAtBoundary(root, textBound.node, textBound.offset)
        if (startOffset !== null) startOffsetRef.current = startOffset
        dragAnchorRef.current = { node: textBound.node, offset: textBound.offset }
        // Set selection anchor to click position so the blue selection extends from here when user drags.
        const selection = window.getSelection()
        if (selection && root.contains(textBound.node)) {
          const anchorRange = document.createRange()
          anchorRange.setStart(textBound.node, textBound.offset)
          anchorRange.collapse(true)
          selection.removeAllRanges()
          selection.addRange(anchorRange)
        }
      }
    }
    const handleMouseMove = (e: MouseEvent) => {
      if (e.buttons !== 1) return
      const storedStart = startOffsetRef.current
      if (storedStart === null) return
      const root = contentRef.current
      if (!root) return
      // Get position under cursor (don't use selection.focusNode — it can be stale and at doc start).
      let focusNode: Node | null = null
      let focusOffset = 0
      if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(e.clientX, e.clientY)
        if (pos && root.contains(pos.offsetNode)) {
          focusNode = pos.offsetNode
          focusOffset = pos.offset
        }
      }
      if ((!focusNode || !root.contains(focusNode)) && document.caretRangeFromPoint) {
        const r = document.caretRangeFromPoint(e.clientX, e.clientY)
        if (r && root.contains(r.startContainer)) {
          focusNode = r.startContainer
          focusOffset = r.startOffset
        }
      }
      if (!focusNode || !root.contains(focusNode)) return
      const focusBound =
        focusNode.nodeType === Node.TEXT_NODE
          ? { node: focusNode as Text, offset: focusOffset }
          : getStartTextBoundary(focusNode, focusOffset)
      if (!focusBound) return
      const focusCharOffset = getOffsetAtBoundary(root, focusBound.node, focusBound.offset)
      if (focusCharOffset === null) return
      // Use offset-based range so selection survives DOM replacement (e.g. applyHighlights during drag).
      const start = Math.min(storedStart, focusCharOffset)
      const end = Math.max(storedStart, focusCharOffset)
      const sel = window.getSelection()
      if (!sel) return
      requestAnimationFrame(() => {
        const r =
          start === end
            ? createRangeFromOffsets(root!, start, start + 1)
            : createRangeFromOffsets(root!, start, end)
        if (!r || !window.getSelection()) return
        if (start === end) r.collapse(true)
        window.getSelection()!.removeAllRanges()
        window.getSelection()!.addRange(r)
      })
    }
    const handleMouseUp = () => {
      dragAnchorRef.current = null
      createRef.current().then((created) => {
        if (created) {
          // Selection already cleared and highlight applied in createHighlightFromSelection
        }
      })
    }
    document.addEventListener('mousedown', handleMouseDown, true)
    document.addEventListener('mousemove', handleMouseMove, true)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true)
      document.removeEventListener('mousemove', handleMouseMove, true)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  return {
    highlights,
    fetchHighlights,
    applyNow,
    createHighlightFromSelection,
    hasSelectionInContent,
    checkSelection,
    isCreating,
  }
}
