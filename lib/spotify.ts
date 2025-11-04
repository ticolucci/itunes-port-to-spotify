import { SpotifyApi } from '@spotify/web-api-ts-sdk'
import type Database from 'better-sqlite3'
import { spotifyTracks } from './schema'

// API response type from Spotify
export interface SpotifyApiTrack {
  id: string
  name: string
  artists: { name: string }[]
  album: { name: string }
  uri: string
}

export interface SpotifySearchParams {
  artist?: string
  album?: string
  track?: string
}

/**
 * Singleton Spotify client that caches search results in the database
 */
class SpotifyClient {
  private static instance: SpotifyClient | null = null
  private db: Database.Database
  private sdk: SpotifyApi | null = null

  private constructor(db: Database.Database) {
    this.db = db
  }

  static getInstance(db: Database.Database): SpotifyClient {
    if (!SpotifyClient.instance) {
      SpotifyClient.instance = new SpotifyClient(db)
    }
    return SpotifyClient.instance
  }

  private getSdk(): SpotifyApi {
    if (!this.sdk) {
      const clientId = process.env.SPOTIFY_CLIENT_ID
      const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

      if (!clientId || !clientSecret) {
        throw new Error('Spotify credentials not configured')
      }

      this.sdk = SpotifyApi.withClientCredentials(clientId, clientSecret)
    }
    return this.sdk
  }

  private buildQuery(params: SpotifySearchParams): string {
    const queryParts: string[] = []
    if (params.artist) queryParts.push(`artist:${params.artist}`)
    if (params.album) queryParts.push(`album:${params.album}`)
    if (params.track) queryParts.push(`track:${params.track}`)
    return queryParts.join(' ')
  }

  /**
   * Search Spotify tracks with memoization
   * First checks the database cache, then queries Spotify API if needed
   */
  async searchTracks(params: SpotifySearchParams): Promise<SpotifyApiTrack[]> {
    const query = this.buildQuery(params)

    // Check cache first
    const cachedTracks = this.db
      .prepare(
        `SELECT spotify_id, name, artists, album, uri
         FROM spotify_tracks
         WHERE search_query = ?
         ORDER BY id`
      )
      .all(query) as Array<{
      spotify_id: string
      name: string
      artists: string
      album: string
      uri: string
    }>

    if (cachedTracks.length > 0) {
      // Return cached results, parsing JSON artists
      return cachedTracks.map((track) => ({
        id: track.spotify_id,
        name: track.name,
        artists: JSON.parse(track.artists),
        album: { name: track.album },
        uri: track.uri,
      }))
    }

    // No cache hit, query Spotify API
    const sdk = this.getSdk()
    const results = await sdk.search(query, ['track'], undefined, 20)
    const tracks = results.tracks.items as SpotifyApiTrack[]

    // Save to cache
    const insertStmt = this.db.prepare(
      `INSERT INTO spotify_tracks (spotify_id, name, artists, album, uri, search_query, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(search_query, spotify_id) DO NOTHING`
    )

    const now = Date.now()
    for (const track of tracks) {
      insertStmt.run(
        track.id,
        track.name,
        JSON.stringify(track.artists.map((a) => ({ name: a.name }))),
        track.album.name,
        track.uri,
        query,
        now
      )
    }

    return tracks
  }
}

// Export singleton instance getter
let spotifyClientInstance: SpotifyClient | null = null

export function getSpotifyClient(db: Database.Database): SpotifyClient {
  if (!spotifyClientInstance) {
    spotifyClientInstance = SpotifyClient.getInstance(db)
  }
  return spotifyClientInstance
}

// Export function to reset singleton (for testing)
export function resetSpotifyClient(): void {
  spotifyClientInstance = null
  // Also reset the class-level instance
  SpotifyClient['instance'] = null
}

/**
 * Legacy function for backward compatibility
 * Search Spotify tracks using artist, album, and/or track name
 */
export async function searchSpotifyTracks(
  params: SpotifySearchParams
): Promise<SpotifyApiTrack[]> {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Spotify credentials not configured')
  }

  // Build tagged query (e.g., "artist:Beatles album:Abbey Road")
  const queryParts: string[] = []
  if (params.artist) queryParts.push(`artist:${params.artist}`)
  if (params.album) queryParts.push(`album:${params.album}`)
  if (params.track) queryParts.push(`track:${params.track}`)

  const query = queryParts.join(' ')

  // Initialize Spotify SDK with client credentials
  const sdk = SpotifyApi.withClientCredentials(clientId, clientSecret)

  // Search for tracks
  const results = await sdk.search(query, ['track'], undefined, 20)

  return results.tracks.items as SpotifyApiTrack[]
}
