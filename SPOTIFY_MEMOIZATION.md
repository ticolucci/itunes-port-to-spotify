# Spotify Search Memoization

This document describes the Spotify search memoization feature implemented in this PR.

## Overview

Spotify search results are now cached in the `spotify_tracks` database table to minimize API calls and improve performance. When the same search query is made multiple times, results are returned from the cache instead of hitting the Spotify API.

## Architecture

### Database Schema

A new `spotify_tracks` table stores cached search results:

```sql
CREATE TABLE spotify_tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  spotify_id TEXT NOT NULL,
  name TEXT NOT NULL,
  artists TEXT NOT NULL,  -- JSON array of artist names
  album TEXT NOT NULL,
  uri TEXT NOT NULL,
  search_query TEXT NOT NULL,  -- The query that found this track
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX idx_spotify_tracks_search_spotify 
  ON spotify_tracks (search_query, spotify_id);
```

The unique index prevents duplicate entries for the same track in the same search query.

### Singleton SpotifyClient

The `SpotifyClient` is now implemented as a singleton that:
1. Takes a database instance in its constructor
2. Checks the cache before making API calls
3. Saves API results to the cache automatically

```typescript
import { getDatabase } from './lib/db'
import { getSpotifyClient } from './lib/spotify'

const db = getDatabase()
const client = getSpotifyClient(db)

// First call hits API and caches
const results1 = await client.searchTracks({ 
  artist: 'Beatles', 
  album: 'Abbey Road' 
})

// Second call uses cache (no API call)
const results2 = await client.searchTracks({ 
  artist: 'Beatles', 
  album: 'Abbey Road' 
})
```

### Server Actions

The `searchSpotifyByArtistAlbum` server action now uses the memoized client:

```typescript
export async function searchSpotifyByArtistAlbum(
  artist: string,
  album: string
) {
  const db = getDatabase()
  const spotifyClient = getSpotifyClient(db)
  const tracks = await spotifyClient.searchTracks({ artist, album })
  
  return { success: true, tracks }
}
```

## Type Changes

To avoid naming conflicts:
- Database type: `SpotifyTrack` (from `lib/schema.ts`)
- API response type: `SpotifyApiTrack` (from `lib/spotify.ts`)

## Benefits

1. **Reduced API calls**: Identical searches use cached data
2. **Faster responses**: Cache lookups are much faster than API calls
3. **API rate limit protection**: Fewer API calls mean less risk of rate limiting
4. **Persistent cache**: Cache survives application restarts

## Testing

Comprehensive test coverage includes:
- Singleton pattern behavior
- Cache hit scenarios
- Cache miss scenarios
- Multiple tracks per query
- Tracks with multiple artists
- Duplicate prevention
- Error handling

Run tests:
```bash
npm test lib/spotify-client.test.ts
npm test lib/spotify-actions.test.ts
```

## Migration

The database migration `0002_ancient_runaways.sql` creates the `spotify_tracks` table. Apply it with:

```bash
npm run db:migrate
```
