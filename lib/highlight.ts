export type HighlightRange = {
  id: string
  startOffset: number
  endOffset: number
  text: string
}

const getTextNodes = (root: HTMLElement) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let current = walker.nextNode()
  while (current) {
    nodes.push(current as Text)
    current = walker.nextNode()
  }
  return nodes
}

/** Character offset from start of root to (node, offset). kind 'end' for element means position before the offset-th child. Survives DOM replacement (no node identity). */
export function getOffsetAtBoundary(
  root: HTMLElement,
  node: Node,
  offset: number,
  kind: 'start' | 'end' = 'start'
): number | null {
  if (!root.contains(node)) return null
  const bound =
    node.nodeType === Node.TEXT_NODE
      ? { node: node as Text, offset: Math.min(offset, node.textContent?.length ?? 0) }
      : kind === 'end'
        ? getEndTextBoundary(node, offset)
        : getStartTextBoundary(node, offset)
  if (!bound) return null
  const r = document.createRange()
  r.setStart(root, 0)
  r.setEnd(bound.node, bound.offset)
  return r.toString().length
}

/** Start boundary: first character at or after (node, offset). Exported so callers can normalize click position to text (node, offset) for correct offset measurement. */
export function getStartTextBoundary(
  node: Node,
  offset: number
): { node: Text; offset: number } | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return { node: node as Text, offset: Math.min(offset, node.textContent?.length ?? 0) }
  }
  const children = node.childNodes
  for (let i = offset; i < children.length; i++) {
    const child = children[i]
    if (!child) continue
    if (child.nodeType === Node.TEXT_NODE) return { node: child as Text, offset: 0 }
    const walker = document.createTreeWalker(child, NodeFilter.SHOW_TEXT)
    const first = walker.nextNode()
    if (first) return { node: first as Text, offset: 0 }
  }
  return null
}

/** End boundary: last character of the selection (position after that character). */
function getEndTextBoundary(node: Node, offset: number): { node: Text; offset: number } | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return { node: node as Text, offset: Math.min(offset, node.textContent?.length ?? 0) }
  }
  if (offset === 0) return null
  const children = node.childNodes
  for (let i = offset - 1; i >= 0; i--) {
    const child = children[i]
    if (!child) continue
    if (child.nodeType === Node.TEXT_NODE) {
      const len = child.textContent?.length ?? 0
      return { node: child as Text, offset: len }
    }
    const walker = document.createTreeWalker(child, NodeFilter.SHOW_TEXT)
    let last: Text | null = null
    let current = walker.nextNode()
    while (current) {
      last = current as Text
      current = walker.nextNode()
    }
    if (last) return { node: last, offset: last.textContent?.length ?? 0 }
  }
  return null
}

export const getOffsetsFromRange = (
  root: HTMLElement,
  range: Range
): { startOffset: number; endOffset: number; text: string } | null => {
  if (!root.contains(range.commonAncestorContainer)) return null
  const selectedText = range.toString()
  if (!selectedText.trim()) return null
  // Normalize to text-node boundaries so measurement matches range.toString() length.
  const startBound = getStartTextBoundary(range.startContainer, range.startOffset)
  const endBound = getEndTextBoundary(range.endContainer, range.endOffset)
  if (!startBound || !endBound) return null
  const startRange = document.createRange()
  startRange.setStart(root, 0)
  startRange.setEnd(startBound.node, startBound.offset)
  const startOffset = startRange.toString().length
  const endRange = document.createRange()
  endRange.setStart(root, 0)
  endRange.setEnd(endBound.node, endBound.offset)
  const endOffset = endRange.toString().length
  // If measured span still doesn't match text length (e.g. cross-root or weird DOM), align end to note text.
  const measuredSpan = endOffset - startOffset
  const endOffsetFinal =
    measuredSpan === selectedText.length ? endOffset : startOffset + selectedText.length
  return {
    startOffset,
    endOffset: endOffsetFinal,
    text: selectedText,
  }
}

export const createRangeFromOffsets = (
  root: HTMLElement,
  startOffset: number,
  endOffset: number
): Range | null => {
  if (endOffset <= startOffset) return null
  const nodes = getTextNodes(root)
  let currentOffset = 0
  let startNode: Text | null = null
  let endNode: Text | null = null
  let startIndex = 0
  let endIndex = 0

  for (const node of nodes) {
    const nodeLength = node.textContent?.length ?? 0
    if (!startNode && currentOffset + nodeLength >= startOffset) {
      startNode = node
      startIndex = Math.max(0, startOffset - currentOffset)
    }
    if (!endNode && currentOffset + nodeLength >= endOffset) {
      endNode = node
      endIndex = Math.max(0, endOffset - currentOffset)
      break
    }
    currentOffset += nodeLength
  }

  if (!startNode || !endNode) return null
  const range = document.createRange()
  range.setStart(startNode, startIndex)
  range.setEnd(endNode, endIndex)
  return range
}

/** Text segments (node + offsets) for a highlight range. Used to wrap each segment in its own mark so we never put block elements inside inline. */
function getHighlightSegments(
  root: HTMLElement,
  startOffset: number,
  endOffset: number
): { node: Text; startInNode: number; endInNode: number }[] {
  if (endOffset <= startOffset) return []
  const nodes = getTextNodes(root)
  let currentOffset = 0
  const segments: { node: Text; startInNode: number; endInNode: number }[] = []
  for (const node of nodes) {
    const nodeLength = node.textContent?.length ?? 0
    const nodeStart = currentOffset
    const nodeEnd = currentOffset + nodeLength
    currentOffset = nodeEnd
    if (nodeEnd <= startOffset || nodeStart >= endOffset) continue
    const startInNode = Math.max(0, startOffset - nodeStart)
    const endInNode = Math.min(nodeLength, endOffset - nodeStart)
    segments.push({ node, startInNode, endInNode })
    if (nodeEnd >= endOffset) break
  }
  return segments
}

export const clearHighlights = (root: HTMLElement) => {
  const highlights = root.querySelectorAll('[data-highlight-id]')
  highlights.forEach((highlight) => {
    const parent = highlight.parentNode
    if (!parent) return
    parent.replaceChild(document.createTextNode(highlight.textContent || ''), highlight)
    parent.normalize()
  })
}

export const applyHighlights = (root: HTMLElement, highlights: HighlightRange[]) => {
  clearHighlights(root)
  const rootTextLength = root.textContent?.length ?? 0
  let appliedCount = 0
  let missingCount = 0
  const ordered = [...highlights].sort((a, b) => b.startOffset - a.startOffset)
  ordered.forEach((highlight) => {
    const segments = getHighlightSegments(root, highlight.startOffset, highlight.endOffset)
    if (segments.length === 0) {
      missingCount += 1
      return
    }
    // Wrap each text segment in its own mark so we never put block elements inside inline (preserves DOM/layout).
    // Process in reverse so replacing a node doesn't invalidate later segments' node refs.
    const markClassName = 'bg-yellow-200 rounded-[2px] px-0.5'
    for (let i = segments.length - 1; i >= 0; i--) {
      const { node, startInNode, endInNode } = segments[i]
      const text = node.textContent ?? ''
      const slice = text.slice(startInNode, endInNode)
      const mark = document.createElement('mark')
      mark.dataset.highlightId = highlight.id
      mark.className = markClassName
      mark.textContent = slice
      const parent = node.parentNode
      if (!parent) continue
      const before = startInNode > 0 ? document.createTextNode(text.slice(0, startInNode)) : null
      const after = endInNode < text.length ? document.createTextNode(text.slice(endInNode)) : null
      const fragment = document.createDocumentFragment()
      if (before) fragment.appendChild(before)
      fragment.appendChild(mark)
      if (after) fragment.appendChild(after)
      parent.replaceChild(fragment, node)
    }
    appliedCount += 1
  })
}
