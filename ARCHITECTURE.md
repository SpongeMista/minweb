# Architecture Overview

## Design Principles

1. **Separation of Concerns**: Clear separation between data ingestion (connectors), storage (Prisma), and presentation (Next.js)
2. **Idempotency**: All sync operations are idempotent - re-syncing won't create duplicates
3. **Error Resilience**: Connectors continue processing other sources/items if one fails
4. **Minimal UI**: Monochrome, calm design with no heavy animations

## Data Flow

### Substack Ingestion

```
User adds RSS URL → Stored in SubstackSource table
    ↓
Cron or manual sync triggers SubstackConnector
    ↓
RSS feed fetched and parsed
    ↓
Items normalized to FeedItem format
    ↓
Upserted to FeedItem table (idempotent via unique constraint)
```

### YouTube Ingestion

```
User signs in with Google → OAuth tokens stored in YouTubeConnection
    ↓
Cron or manual sync triggers YouTubeConnector
    ↓
YouTube API: Get subscriptions
    ↓
For each subscription: Get recent uploads (last 10 videos)
    ↓
Items normalized to FeedItem format
    ↓
Upserted to FeedItem table (idempotent via unique constraint)
```

### Feed Display

```
User requests feed → GET /api/feed
    ↓
getFeed() queries FeedItem table
    ↓
Cursor-based pagination applied
    ↓
Filtered by source/search if provided
    ↓
Returns paginated results with nextCursor
```

## Connector Pattern

All connectors implement the `Connector` interface:

```typescript
interface Connector {
  sync(userId: string): Promise<FeedItem[]>
}
```

### BaseConnector

Provides common functionality:
- `upsertFeedItems()`: Idempotent database upserts
- `normalizeTimestamp()`: Ensures UTC timestamps

### SubstackConnector

- Fetches RSS feeds using `rss-parser`
- Handles various RSS formats and edge cases
- Extracts: title, author, publishedAt, excerpt, url, thumbnail
- Validates all data with Zod schemas

### YouTubeConnector

- Uses Google APIs client library
- Handles OAuth token refresh automatically
- Fetches subscriptions, then recent uploads per channel
- Respects API quotas by limiting requests
- Extracts: videoId, channel name, publishedAt, title, thumbnail, url

## Database Schema

### Key Models

- **User**: NextAuth user accounts
- **SubstackSource**: User's RSS feed URLs
- **YouTubeConnection**: OAuth tokens for YouTube API
- **FeedItem**: Normalized feed items (unified format)

### Idempotency

FeedItem uses unique constraint: `(userId, source, sourceId)`
- Prevents duplicates on re-sync
- Allows updating existing items

## API Routes

### Authentication
- `/api/auth/[...nextauth]`: NextAuth handler

### Feed
- `GET /api/feed`: Paginated feed with cursor-based pagination
  - Query params: `cursor`, `limit`, `source`, `search`

### Sync
- `POST /api/sync`: Manual sync trigger
  - Body: `{ source?: 'substack' | 'youtube' | 'all' }`

### Substack Management
- `GET /api/substack`: List user's sources
- `POST /api/substack`: Add new source
- `PUT /api/substack`: Update source
- `DELETE /api/substack`: Remove source

### YouTube
- `GET /api/youtube/status`: Check connection status

### Cron
- `GET /api/cron/sync`: Scheduled sync (Vercel Cron compatible)

## Frontend Architecture

### Pages

- `/`: Redirects to feed if authenticated, signin if not
- `/feed`: Main feed view with infinite scroll
- `/settings`: Manage Substack sources and YouTube connection
- `/auth/signin`: Authentication page

### Components

- `FeedItem`: Individual feed item display
- `FeedFilters`: Source filter and search
- `SyncButton`: Manual sync trigger

### State Management

- **TanStack Query**: Server state management
  - Infinite queries for feed pagination
  - Mutations for sync and source management
- **React State**: Local UI state (filters, search)

## Security

- All API routes check authentication via `getServerSession()`
- OAuth tokens stored securely in database
- RSS feeds validated before storage
- Input validation with Zod schemas

## Error Handling

- Connectors catch and log errors, continue processing
- API routes return appropriate HTTP status codes
- Frontend shows error messages to users
- Failed syncs don't break the entire process

## Performance Considerations

- Cursor-based pagination for efficient feed loading
- Database indexes on `(userId, publishedAt)` and `(userId, source)`
- YouTube connector limits to 10 videos per channel
- RSS feeds cached in database (no re-fetching on every request)
- TanStack Query caching reduces API calls

## Testing Strategy

- Unit tests for:
  - Feed pagination logic
  - RSS parsing and normalization
  - Data validation (Zod schemas)
- Integration tests: (TODO - can be added)
  - API route authentication
  - Connector sync flows

## Deployment

### Vercel (Recommended)

- Automatic builds and deployments
- Cron jobs configured via `vercel.json`
- Environment variables in dashboard
- Database connection via connection pooling

### Other Platforms

- Build: `npm run build`
- Start: `npm start`
- Set up cron for `/api/cron/sync` (every 6 hours)
- Ensure PostgreSQL connection is available

## Future Enhancements (Not in MVP)

- Rate limiting per user
- Webhook support for real-time updates
- More sources (Twitter, Medium, etc.)
- User preferences (notification settings)
- Export feed as RSS
- Mobile app
- Advanced search with full-text search

