# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript/Next.js project that ports an iTunes music library to Spotify. It parses iTunes library metadata into a SQLite database and uses the Spotify API to search for matching tracks.

## Development Commands

### Dependencies
```bash
# Install dependencies
npm install

# Setup Spotify API credentials (required for matching features)
cp .env.example .env.local
# Then edit .env.local with your Spotify API credentials from https://developer.spotify.com/dashboard
```

### Next.js Development
```bash
# Run development server
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Linting

This project uses **ESLint** with Next.js and TypeScript configurations.

```bash
# Run linter
npm run lint
```

#### ESLint Configuration

- Config file: `eslint.config.mjs` using flat config format with FlatCompat
- Extends `next/core-web-vitals` and `next/typescript`
- Strict TypeScript rules are set to "warn" to allow incremental fixes

#### Linting Patterns and Solutions

**Test files with mock types:**
- Use file-level disable for `@typescript-eslint/no-explicit-any` in test files
- Add `/* eslint-disable @typescript-eslint/no-explicit-any */` at the top of test files
- Example: `lib/spotify.test.ts`, `app/spotify-matcher/page.test.tsx`
- Do NOT add explanatory comments - the disable is self-documenting

**Empty object return types:**
- DO NOT use `ActionResult<{}>` - it's ambiguous
- Use explicit union types: `Promise<{ success: true } | { success: false; error: string }>`
- Example: `saveSongMatch()` and `clearSongMatch()` in `lib/spotify-actions.ts`

**Config files with CommonJS syntax:**
- Use inline disable for `@typescript-eslint/no-require-imports` in config files
- Add comment directly above the `require()` statement
- Example: `tailwind.config.ts` plugins array

**External images (Spotify CDN):**
- Use inline disable for `@next/next/no-img-element` when displaying external CDN images
- Spotify images are already optimized; Next.js Image component adds no value
- Add comment: `// eslint-disable-next-line @next/next/no-img-element -- Spotify CDN images are already optimized`
- Example: `app/spotify-matcher/ReviewCard.tsx`, `app/spotify-matcher/page.tsx`

**React Hook dependencies:**
- Wrap functions in `useCallback` when they're used as dependencies
- Add `// eslint-disable-next-line react-hooks/exhaustive-deps` if intentionally omitting deps
- Example: `loadNextAlbum` in `app/spotify-matcher/page.tsx`

### Database Migrations

This project uses **Drizzle ORM** for database schema management and migrations.

#### Migration Commands
```bash
# Generate a new migration after changing lib/schema.ts
npm run db:generate

# Apply pending migrations to the database
npm run db:migrate

# Push schema changes directly to DB (dev only, skips migration files)
npm run db:push

# Pull existing database schema into TypeScript
npm run db:pull

# Launch Drizzle Studio (visual database browser)
npm run db:studio
```

#### Migration Workflow

**Making schema changes:**
1. Edit the schema definition in `lib/schema.ts`
2. Run `npm run db:generate` to create a timestamped migration SQL file
3. Review the generated SQL in `drizzle/migrations/`
4. Run `npm run db:migrate` to apply the migration
5. Commit both `lib/schema.ts` and the migration files

**Schema definition:**
- The TypeScript schema is in `lib/schema.ts`
- Drizzle auto-generates TypeScript types from the schema
- Use exported types (`Song`, `NewSong`) in Server Actions and queries

**Migration files:**
- Stored in `drizzle/migrations/` (version controlled)
- Each migration is timestamped and tracked in `__drizzle_migrations` table
- Migrations are idempotent and safe to run multiple times

**For new databases:**
- Run `npm run db:migrate` to create tables and apply all migrations

**For existing databases:**
- If adding migrations to an existing database with tables already created, manually mark migrations as applied:
  ```bash
  sqlite3 database.db "INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('XXXX_migration_name', $(date +%s)000);"
  ```

## Architecture

### Core Components

**Database Schema** (`lib/schema.ts`)
- Drizzle ORM schema definition for the songs table
- Auto-generates TypeScript types (`Song`, `NewSong`) for type-safe queries
- Fields: id, title, artist, album, album_artist, filename, spotify_id
- Database connection managed by `lib/db.ts` singleton using libsql client

**Spotify Integration** (`lib/spotify.ts`)
- Modern Spotify API client using official `@spotify/web-api-ts-sdk`
- `searchSpotifyTracks()` - Searches Spotify tracks by artist, album, and/or track name
- Uses client credentials flow with credentials from `.env.local`
- Server Actions in `lib/spotify-actions.ts`:
  - `getNextUnmatchedSong()` - Fetches first song without spotify_id
  - `getSongsByArtist()` - Gets all songs by artist, sorted by album
  - `searchSpotifyByArtistAlbum()` - Searches Spotify for tracks
  - `saveSongMatch()` - Saves spotify_id for matched song

**SpotifyMatcher Page** (`app/spotify-matcher/page.tsx`)
- Interactive UI for matching iTunes songs with Spotify tracks
- Shows current unmatched song with artist's album tracks
- Displays Spotify search results with similarity scoring
- One-click matching to save spotify_id to database

**Bootstrap Script** (`scripts/bootstrap_songs_table_from_itunes_lib.rb`)
- One-time import script that parses iTunes library JSON export (`ipod_library_with_files.txt`)
- Creates/drops songs table and populates it with metadata
- Expects newline-delimited JSON format where each song object is on separate lines

### Database Schema

**Unified Database Client:**
- Uses `@libsql/client` for all environments (local development, production, CI)
- **Local Development**: Connects to local SQLite file via `file:./database.db` URL
- **Production/CI**: Connects to Turso (cloud SQLite) via HTTPS URL
- Database selection is automatic based on environment variables

**Connection Logic** (`lib/db.ts`):
- If `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are set, connects to Turso
- Otherwise, uses local SQLite file via libsql's `file:` protocol
- Singleton pattern ensures one connection per process
- Returns Drizzle ORM instance for type-safe queries

**Schema:**
- Schema defined in `lib/schema.ts`
- Fields: id (primary key), title, album, artist, album_artist, filename, spotify_id
- Index on (artist, album, album_artist)
- Migrations stored in `drizzle/migrations/`

**Environment Variables:**
- `TURSO_DATABASE_URL`: Turso database URL (e.g., `libsql://db-name.turso.io`)
- `TURSO_AUTH_TOKEN`: Turso authentication token
- See `.env.example` for setup instructions

The local database file is encrypted with git-crypt and should not be committed unencrypted.

### Security & Secrets

- **git-crypt** is used to encrypt sensitive files (`database.db`, `.env.local`, `*.key`, `*.pem`)
- See `README_git_crypt.md` for setup instructions
- `.env.local` contains SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET for Spotify API
- Never commit unencrypted secrets

## CI/CD Pipeline

**GitHub Actions Workflow** (`.github/workflows/ci-cd.yml`):

**On every push/PR:**
1. Install dependencies (`npm ci`)
2. Run linter (`npm run lint`) - must pass with 0 errors
3. Run tests (`npm test`) - currently continue-on-error while updating test mocks
4. Build application (`npm run build`) - must succeed

**On push to main branch only:**
5. Run production database migrations on Turso
   - Uses `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` from GitHub secrets
   - Automatically applies pending migrations to production database
6. Deploy to Vercel (only if migrations succeed)
   - Uses Vercel CLI to deploy to production
   - Ensures database is migrated before new code goes live

**On pull requests:**
7. Create or update Turso branch database for the PR via Platform API
   - Branch database named `itunes-spotify-pr-<number>`
   - Seeded from production database (schema + data copy)
   - Provides isolated database for preview testing
8. Run migrations on branch database
9. Deploy preview to Vercel with branch database credentials (7-day tokens)
10. Comment on PR with preview URL and database info
11. Auto-cleanup branch database when PR closes (via API)

**GitHub Secrets Required:**
- `TURSO_DATABASE_URL`: Production database URL
- `TURSO_AUTH_TOKEN`: Production database auth token
- `TURSO_API_TOKEN`: Turso Platform API token for managing branch databases
- `TURSO_ORG_NAME`: Turso organization name
- `TURSO_PRIMARY_DB_NAME`: Name of primary database to branch from
- `VERCEL_TOKEN`: Vercel API token for deployments
- `VERCEL_ORG_ID`: Vercel organization/team ID
- `VERCEL_PROJECT_ID`: Vercel project ID

**Migration Strategy:**
- Local development: Migrations run against local `database.db`
- Production: Migrations auto-run via GitHub Actions on main branch merges
- Migration script (`lib/migrate.ts`) automatically detects environment

## Deployment

**Vercel Deployment:**

This project is configured for deployment on Vercel. See `VERCEL_SETUP.md` for detailed setup instructions.

**Quick Start:**
1. Connect your GitHub repository to Vercel
2. Configure environment variables (SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, TURSO_DATABASE_URL, TURSO_AUTH_TOKEN)
3. Deploy

**Deployment Strategy:**
- **Production (main branch)**: Controlled by GitHub Actions
  - Automatic Vercel deployments are disabled for production
  - GitHub Actions runs migrations first, then deploys to Vercel
  - Ensures database schema is updated before new code goes live
- **Preview (pull requests)**: Controlled by GitHub Actions with Turso database branching
  - Each PR gets an isolated Turso database branch via Platform API
  - Branch database is seeded from production (schema + data copy)
  - Migrations run on branch database before preview deployment
  - Temporary credentials (7-day expiration) generated via API
  - Preview deployment uses branch database credentials
  - Safe testing of schema changes and features without affecting production
  - Branch database automatically deleted via API when PR closes
  - No CLI installation required - all operations use Turso Platform API

**Configuration Files:**
- `vercel.json` - Build and deployment settings
- `.vercelignore` - Excludes local database, tests, and documentation from deployment

**Environment Variables Required in Vercel:**
- `SPOTIFY_CLIENT_ID` - Spotify API credentials
- `SPOTIFY_CLIENT_SECRET` - Spotify API credentials
- `TURSO_DATABASE_URL` - Production database URL
- `TURSO_AUTH_TOKEN` - Production database auth token

## Future Work

See `Stories.md` for planned features and current priorities, including:
- Spotify query escaping for special characters
- OAuth flow for user library mutations (add matched songs to Spotify playlists)
- Rate limiting and retry logic
- Token expiration handling
- Search and delete functionality in songs browser UI
