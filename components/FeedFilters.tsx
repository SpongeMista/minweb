'use client'

interface FeedFiltersProps {
  sourceFilter: string
  onSourceFilterChange: (value: string) => void
  searchQuery: string
  onSearchQueryChange: (value: string) => void
}

export default function FeedFilters({
  sourceFilter,
  onSourceFilterChange,
  searchQuery,
  onSearchQueryChange,
}: FeedFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="flex-1">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Search..."
          className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:border-black"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSourceFilterChange('')}
          className={`px-4 py-2 border transition-colors ${
            sourceFilter === ''
              ? 'border-black bg-black text-white'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          All
        </button>
        <button
          onClick={() => onSourceFilterChange('substack')}
          className={`px-4 py-2 border transition-colors ${
            sourceFilter === 'substack'
              ? 'border-black bg-black text-white'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          Substack
        </button>
        <button
          onClick={() => onSourceFilterChange('youtube')}
          className={`px-4 py-2 border transition-colors ${
            sourceFilter === 'youtube'
              ? 'border-black bg-black text-white'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          YouTube
        </button>
      </div>
    </div>
  )
}

