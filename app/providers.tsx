'use client'

import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

async function fetchSettings() {
  const res = await fetch('/api/settings')
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

function GreyscaleModeEffect() {
  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  useEffect(() => {
    const root = document.documentElement
    if (settingsData?.greyscaleThumbnails) {
      root.classList.add('greyscale-mode')
    } else {
      root.classList.remove('greyscale-mode')
    }

    return () => {
      root.classList.remove('greyscale-mode')
    }
  }, [settingsData?.greyscaleThumbnails])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <GreyscaleModeEffect />
      {children}
    </QueryClientProvider>
  )
}

