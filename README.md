# Minimal Web

A unified chronological feed aggregator for Substack newsletters and YouTube subscriptions. Built with Next.js 14, TypeScript, Prisma, and a minimalist monochrome design.

## Features

- **Substack Integration**: Add RSS feeds from Substack newsletters
- **YouTube Integration**: Connect your YouTube account to sync subscriptions
- **Unified Feed**: Chronological feed combining both sources
- **Cursor-based Pagination**: Efficient infinite scroll
- **Search & Filters**: Filter by source and search content
- **Minimalist UI**: Clean, monochrome design with calm typography

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js (Google OAuth + Email/Magic Link)
- **Styling**: Tailwind CSS
- **Data Fetching**: TanStack Query
- **Validation**: Zod

## Project Structure

```
.
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── auth/          # NextAuth routes
│   │   ├── feed/          # Feed API
│   │   ├── sync/          # Manual sync endpoint
│   │   ├── substack/      # Substack source management
│   │   ├── youtube/       # YouTube status
│   │   └── cron/          # Scheduled sync (Vercel Cron)
│   ├── auth/              # Auth pages
│   ├── feed/              # Main feed page
│   └── settings/          # Settings page
├── components/            # React components
├── lib/                   # Core libraries
│   ├── connectors/        # Data source connectors
│   │   ├── base.ts        # Base connector class
│   │   ├── substack.ts    # Substack RSS connector
│   │   └── youtube.ts     # YouTube API connector
│   ├── auth.ts            # NextAuth configuration
│   ├── db.ts              # Prisma client
│   ├── feed.ts            # Feed pagination logic
│   └── types.ts           # TypeScript types & Zod schemas
├── prisma/                # Prisma schema and migrations
└── __tests__/             # Unit tests
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Google OAuth credentials (for YouTube integration)

### Installation

1. **Clone and install dependencies:**

```bash
npm install
```

2. **Set up environment variables:**

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_URL`: Your app URL (e.g., `http://localhost:3000`)
- `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `EMAIL_*`: Email server config (optional, for magic link auth)

3. **Set up the database:**

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Or push schema (for development)
npm run db:push
```

4. **Run the development server:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## YouTube OAuth Setup

1. **Create a Google Cloud Project:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable YouTube Data API v3:**
   - Navigate to "APIs & Services" > "Library"
   - Search for "YouTube Data API v3" and enable it

3. **Create OAuth 2.0 Credentials:**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: "Web application"
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` (add production URL for production)

4. **Configure Scopes:**
   - The app requests: `https://www.googleapis.com/auth/youtube.readonly`
   - This scope allows reading subscriptions and channel information

5. **Add Credentials to `.env`:**
   ```
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

### YouTube API Quota Notes

- Default quota: 10,000 units per day
- `subscriptions.list`: 1 unit per request
- `channels.list`: 1 unit per request
- `playlistItems.list`: 1 unit per request
- The connector fetches up to 10 recent videos per channel to minimize quota usage
- Results are cached in the database to avoid redundant API calls

## Adding Substack Newsletters

1. **Find the RSS Feed URL:**
   - Most Substack publications have RSS feeds at: `https://[publication].substack.com/feed`
   - You can also find it by looking for the RSS icon on the publication page

2. **Add via Settings:**
   - Go to Settings page
   - Click "Add Newsletter"
   - Enter the publication name and RSS feed URL
   - Click "Add"

3. **Manual RSS URL Format:**
   - Standard: `https://[publication].substack.com/feed`
   - Some publications may use custom domains

The app will automatically:
- Parse RSS feed items
- Extract title, author, published date, excerpt, and thumbnail
- Store items with idempotency (no duplicates on re-sync)
- Handle missing or inconsistent fields gracefully

## Scheduled Syncing

The app includes a cron route for automatic syncing:

- **Route**: `/api/cron/sync`
- **Schedule**: Every 6 hours (configurable in `vercel.json`)
- **Vercel Cron**: Automatically configured when deployed to Vercel
- **Local Development**: Can be triggered manually or set up with a cron service

To trigger manually:
```bash
curl http://localhost:3000/api/cron/sync
```

For production, add a `CRON_SECRET` environment variable and use it in the Authorization header:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/sync
```

## API Endpoints

### Feed
- `GET /api/feed` - Get paginated feed items
  - Query params: `cursor`, `limit`, `source`, `search`

### Sync
- `POST /api/sync` - Manually trigger sync
- Body: `{ source?: 'substack' | 'youtube' | 'reddit' | 'all' }`

### Substack Sources
- `GET /api/substack` - List user's Substack sources
- `POST /api/substack` - Add a new source
  - Body: `{ rssUrl: string, publicationName: string }`
- `PUT /api/substack` - Update a source
- `DELETE /api/substack?id=...` - Remove a source

### YouTube
- `GET /api/youtube/status` - Check YouTube connection status

## Testing

Run tests with:

```bash
npm test
```

Tests cover:
- Feed pagination logic
- RSS parsing and normalization
- Data validation with Zod schemas

## Database Schema

Key models:
- **User**: NextAuth user accounts
- **SubstackSource**: User's added RSS feeds
- **YouTubeConnection**: OAuth tokens for YouTube
- **FeedItem**: Normalized feed items from all sources

See `prisma/schema.prisma` for full schema.

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

The `vercel.json` file configures automatic cron jobs.

### Other Platforms

- Ensure PostgreSQL database is accessible
- Set all environment variables
- Run `npm run build` and `npm start`
- Set up cron job for `/api/cron/sync` (every 6 hours recommended)

## Development Notes

- **Idempotency**: Feed items use `(userId, source, sourceId)` unique constraint to prevent duplicates
- **Error Handling**: Connectors continue processing other sources/items if one fails
- **Rate Limiting**: YouTube connector respects API quotas by limiting requests per channel
- **Token Refresh**: YouTube OAuth tokens are automatically refreshed when expired

## License

MIT

