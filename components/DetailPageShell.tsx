'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Prevents body scroll on detail pages. Renders nothing; call from layout
 * or a component that's always mounted when viewing the app.
 */
export function DetailPageScrollLock() {
  const pathname = usePathname()
  const isDetailPage = Boolean(pathname?.match(/^\/(reddit|email|youtube)\/[^/]+/))

  useEffect(() => {
    if (!isDetailPage) return
    const prevOverflow = document.body.style.overflow
    const prevHeight = document.body.style.height
    document.body.style.overflow = 'hidden'
    document.body.style.height = '100vh'
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.height = prevHeight
    }
  }, [isDetailPage])

  return null
}
