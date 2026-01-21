# Setup Guide

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

3. **Set up database:**
   ```bash
   npm run db:generate
   npm run db:push
   ```

4. **Run development server:**
   ```bash
   npm run dev
   ```

## Environment Variables

### Required

- `DATABASE_URL`: PostgreSQL connection string
  - Example: `postgresql://user:password@localhost:5432/minimal_web?schema=public`
- `NEXTAUTH_URL`: Your app URL
  - Development: `http://localhost:3000`
  - Production: `https://your-domain.com`
- `NEXTAUTH_SECRET`: Random secret for session encryption
  - Generate: `openssl rand -base64 32`

### YouTube Integration (Required for YouTube features)

- `GOOGLE_CLIENT_ID`: From Google Cloud Console
- `GOOGLE_CLIENT_SECRET`: From Google Cloud Console

### Email Auth (Optional)

If you want to use email/magic link authentication:

- `EMAIL_SERVER_HOST`: SMTP server hostname
- `EMAIL_SERVER_PORT`: SMTP port (usually 587)
- `EMAIL_SERVER_USER`: SMTP username
- `EMAIL_SERVER_PASSWORD`: SMTP password
- `EMAIL_FROM`: Sender email address

### Cron (Optional, for production)

- `CRON_SECRET`: Secret for protecting cron endpoint

## Database Setup

### Using PostgreSQL

1. **Install PostgreSQL** (if not already installed)

2. **Create database:**
   ```sql
   CREATE DATABASE minimal_web;
   ```

3. **Update DATABASE_URL in .env:**
   ```
   DATABASE_URL="postgresql://username:password@localhost:5432/minimal_web?schema=public"
   ```

4. **Run migrations:**
   ```bash
   npm run db:migrate
   ```

   Or for development (pushes schema without migration files):
   ```bash
   npm run db:push
   ```

### Using Docker (Alternative)

```bash
docker run --name minimal-web-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=minimal_web \
  -p 5432:5432 \
  -d postgres:15
```

Then use: `DATABASE_URL="postgresql://postgres:password@localhost:5432/minimal_web?schema=public"`

## Google OAuth Setup (YouTube)

1. **Go to [Google Cloud Console](https://console.cloud.google.com/)**

2. **Create or select a project**

3. **Enable YouTube Data API v3:**
   - Navigate to "APIs & Services" > "Library"
   - Search for "YouTube Data API v3"
   - Click "Enable"

4. **Create OAuth 2.0 credentials:**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: "Web application"
   - Name: "Minimal Web" (or your choice)
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (development)
     - `https://your-domain.com/api/auth/callback/google` (production)

5. **Copy credentials to .env:**
   ```
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

6. **Configure OAuth consent screen:**
   - Go to "APIs & Services" > "OAuth consent screen"
   - Choose "External" (unless you have Google Workspace)
   - Fill in required fields
   - Add scopes: `https://www.googleapis.com/auth/youtube.readonly`
   - Add test users (for development) or publish (for production)

## Testing the Setup

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Visit http://localhost:3000**

3. **Sign in:**
   - Try Google OAuth (should redirect to Google)
   - Or use email/magic link (if configured)

4. **Add a Substack newsletter:**
   - Go to Settings
   - Add a newsletter RSS URL (e.g., `https://stratechery.com/feed`)

5. **Connect YouTube:**
   - Sign in with Google (if not already)
   - Go to Settings to verify connection

6. **Sync:**
   - Click "Sync Now" in the feed
   - Check that items appear in the feed

## Troubleshooting

### Database Connection Issues

- Verify PostgreSQL is running: `pg_isready`
- Check DATABASE_URL format
- Ensure database exists: `psql -l` (should list minimal_web)

### OAuth Issues

- Verify redirect URI matches exactly (including http/https, port, trailing slash)
- Check OAuth consent screen is configured
- Ensure YouTube Data API v3 is enabled
- Check browser console for errors

### RSS Feed Issues

- Verify RSS URL is accessible: `curl https://publication.substack.com/feed`
- Check feed format is valid RSS/Atom
- Some publications may require authentication (not supported yet)

### Build Issues

- Clear `.next` folder: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Regenerate Prisma client: `npm run db:generate`

## Production Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add all environment variables
4. Deploy

Vercel will automatically:
- Run `npm run build`
- Set up cron jobs (from `vercel.json`)
- Handle database connections

### Other Platforms

1. Set environment variables
2. Run `npm run build`
3. Start with `npm start`
4. Set up cron job for `/api/cron/sync` (every 6 hours recommended)

## Next Steps

- Add more Substack newsletters
- Connect YouTube account
- Customize UI (if desired)
- Set up production database
- Configure email service (for magic links)

