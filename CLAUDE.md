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
- Database connection managed by `lib/db.ts` singleton with WAL mode

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

SQLite database (`database.db`) managed by Drizzle ORM:
- Schema defined in `lib/schema.ts`
- Fields: id (primary key), title, album, artist, album_artist, filename, spotify_id
- Index on (artist, album, album_artist)
- Migrations stored in `drizzle/migrations/`

The database file is encrypted with git-crypt and should not be committed unencrypted.

### Security & Secrets

- **git-crypt** is used to encrypt sensitive files (`database.db`, `.env.local`, `*.key`, `*.pem`)
- See `README_git_crypt.md` for setup instructions
- `.env.local` contains SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET for Spotify API
- Never commit unencrypted secrets

## Future Work

See `Stories.md` for planned features and current priorities, including:
- Spotify query escaping for special characters
- OAuth flow for user library mutations (add matched songs to Spotify playlists)
- Rate limiting and retry logic
- Token expiration handling
- Search and delete functionality in songs browser UI
