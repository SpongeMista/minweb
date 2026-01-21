'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'

async function syncFeeds(source?: 'substack' | 'youtube' | 'all') {
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: source || 'all' }),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to sync' }))
    throw new Error(error.error || 'Failed to sync')
  }
  return res.json()
}

interface SyncButtonProps {
  onSyncComplete?: () => void
}

export default function SyncButton({ onSyncComplete }: SyncButtonProps) {
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: syncFeeds,
    onSuccess: (data) => {
      setLastSync(new Date())
      
      // Check for errors in results
      const errors = data.results?.filter((r: any) => r.error) || []
      const successes = data.results?.filter((r: any) => !r.error) || []
      
      if (errors.length > 0) {
        const errorMessages = errors.map((e: any) => `${e.source}: ${e.error}`).join(', ')
        setSyncResult(`Error: ${errorMessages}`)
      } else if (successes.length > 0) {
        const totalCount = successes.reduce((sum: number, r: any) => sum + r.count, 0)
        const summary = successes.map((r: any) => `${r.source}: ${r.count}`).join(', ')
        setSyncResult(`Synced ${totalCount} items (${summary})`)
      } else {
        setSyncResult('No items found to sync')
      }
      
      // Clear message after 5 seconds
      setTimeout(() => setSyncResult(null), 5000)
      
      onSyncComplete?.()
    },
    onError: (error: Error) => {
      setSyncResult(`Error: ${error.message}`)
      setTimeout(() => setSyncResult(null), 5000)
    },
  })

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setSyncResult(null)
            mutation.mutate('all')
          }}
          disabled={mutation.isPending}
          className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm"
        >
          {mutation.isPending ? 'Syncing...' : 'Sync Now'}
        </button>
        {lastSync && !mutation.isPending && !syncResult && (
          <span className="text-xs text-gray-400">
            Synced {lastSync.toLocaleTimeString()}
          </span>
        )}
      </div>
      {syncResult && (
        <span
          className={`text-xs ${
            syncResult.startsWith('Error') ? 'text-red-600' : 'text-gray-600'
          }`}
        >
          {syncResult}
        </span>
      )}
    </div>
  )
}

