import { useEffect, useState } from 'react'

const STORAGE_KEY = 'hideThumbnails'

export function readHideThumbnailsPreference(): boolean | null {
  if (typeof window === 'undefined') return null
  const value = window.localStorage.getItem(STORAGE_KEY)
  if (value === null) return null
  return value === 'true'
}

export function readHideThumbnailsPreferenceSync(): boolean | null {
  if (typeof window === 'undefined') return null
  const value = window.localStorage.getItem(STORAGE_KEY)
  if (value === null) return null
  return value === 'true'
}

export function writeHideThumbnailsPreference(value: boolean) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false')
}

export function useHideThumbnailsPreference(initialValue?: boolean | null) {
  const [value, setValue] = useState<boolean | null>(initialValue ?? null)

  useEffect(() => {
    const stored = readHideThumbnailsPreference()
    if (stored !== null) {
      setValue(stored)
    } else if (initialValue !== undefined && initialValue !== null) {
      writeHideThumbnailsPreference(initialValue)
      setValue(initialValue)
    }
  }, [initialValue])

  return [value, setValue] as const
}
