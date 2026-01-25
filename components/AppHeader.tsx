'use client'

import Link from 'next/link'

export default function AppHeader() {
  return (
    <header
      data-app-header="true"
      className="sticky top-0 z-50 border-b border-gray-200 bg-[#F5F5F5]/80 backdrop-blur-sm"
    >
      <div className="w-full px-4 py-2 flex items-center justify-between">
        <Link href="/" className="text-lg font-mono text-black no-underline">
          clear-feed
        </Link>
        <Link
          href="/settings"
          aria-label="Settings"
          className="text-gray-600 hover:text-black transition-colors"
          onClick={() => {
            if (window.location.pathname === '/' || window.location.pathname === '/feed') {
              sessionStorage.setItem('feedScrollOverride', '1')
              sessionStorage.setItem('feedScrollY', String(window.scrollY))
              sessionStorage.setItem('feedRestoreKey', 'settings')
            }
          }}
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
              d="M11.9999 14.5C13.3806 14.5 14.4999 13.3807 14.4999 12C14.4999 10.6193 13.3806 9.5 11.9999 9.5C10.6192 9.5 9.49988 10.6193 9.49988 12C9.49988 13.3807 10.6192 14.5 11.9999 14.5Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M19.4 12.94C19.44 12.63 19.46 12.31 19.46 12C19.46 11.69 19.44 11.37 19.4 11.06L21.51 9.41C21.63 9.32 21.67 9.15 21.58 9.02L19.58 5.56C19.5 5.42 19.33 5.37 19.2 5.42L16.71 6.42C16.2 6.03 15.64 5.71 15.04 5.48L14.66 2.83C14.64 2.68 14.51 2.58 14.36 2.58H9.64C9.49 2.58 9.36 2.68 9.34 2.83L8.96 5.48C8.36 5.71 7.8 6.03 7.29 6.42L4.8 5.42C4.67 5.37 4.5 5.42 4.42 5.56L2.42 9.02C2.33 9.15 2.37 9.32 2.49 9.41L4.6 11.06C4.56 11.37 4.54 11.69 4.54 12C4.54 12.31 4.56 12.63 4.6 12.94L2.49 14.59C2.37 14.68 2.33 14.85 2.42 14.98L4.42 18.44C4.5 18.58 4.67 18.63 4.8 18.58L7.29 17.58C7.8 17.97 8.36 18.29 8.96 18.52L9.34 21.17C9.36 21.32 9.49 21.42 9.64 21.42H14.36C14.51 21.42 14.64 21.32 14.66 21.17L15.04 18.52C15.64 18.29 16.2 17.97 16.71 17.58L19.2 18.58C19.33 18.63 19.5 18.58 19.58 18.44L21.58 14.98C21.67 14.85 21.63 14.68 21.51 14.59L19.4 12.94Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>
    </header>
  )
}
