import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from '@/components/ui/toaster'
import AppHeader from '@/components/AppHeader'
import { NotesDrawerProvider } from '@/components/NotesDrawerContext'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Minimal Web',
  description: 'Unified feed from Substack and YouTube',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <NotesDrawerProvider>
            <div className="flex flex-col h-screen overflow-hidden">
              <div className="flex-shrink-0">
                <AppHeader />
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {children}
              </div>
            </div>
          </NotesDrawerProvider>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}

