import Link from 'next/link'

async function fetchEmailItem(id: string) {
  const res = await fetch(`${process.env.NEXTAUTH_URL || ''}/api/email/${id}`, {
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error('Failed to fetch email item')
  }
  const data = await res.json()
  return data.item
}

export default async function EmailPage({ params }: { params: { id: string } }) {
  const item = await fetchEmailItem(params.id)

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <header className="border-b border-gray-200">
        <div className="max-w-[648px] mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-light text-black">
            Minimal Web
          </Link>
        </div>
      </header>

      <main className="max-w-[648px] mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/"
            aria-label="Back to Feed"
            className="text-gray-600 hover:text-black transition-colors"
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
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <h1 className="text-2xl font-semibold text-black">Email</h1>
        </div>

        <article className="bg-white rounded-[26px] p-5">
          <h2 className="text-xl font-semibold mb-2">{item.title}</h2>
          <div className="text-sm text-gray-600 mb-4">
            {item.author && <span>{item.author}</span>}
            {item.author && <span className="mx-2 text-gray-400">·</span>}
            <span>{new Date(item.publishedAt).toLocaleString()}</span>
          </div>

          {item.excerpt ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.excerpt}</p>
          ) : (
            <p className="text-sm text-gray-500">
              This email did not include a readable body. Only the subject was available.
            </p>
          )}
        </article>
      </main>
    </div>
  )
}
