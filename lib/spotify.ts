import { SpotifyApi } from '@spotify/web-api-ts-sdk'
import { getCachedSearch, setCachedSearch } from './spotify-cache'

export interface SpotifyTrack {
  id: string
  name: string
  artists: { name: string }[]
  album: {
    name: string
    images: { url: string; height: number; width: number }[]
  }
  uri: string
}

export interface SpotifySearchParams {
  artist?: string
  album?: string
  track?: string
}

/**
 * Search Spotify tracks using artist, album, and/or track name.
 * Results are cached for 24 hours to reduce API calls.
 */
export async function searchSpotifyTracks(
  params: SpotifySearchParams
): Promise<SpotifyTrack[]> {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Spotify credentials not configured')
  }

  // Build tagged query (e.g., "artist:Beatles album:Abbey Road")
  // Filter out null/empty values and trim whitespace
  const queryParts: string[] = []
  if (params.artist?.trim()) queryParts.push(`artist:${params.artist.trim()}`)
  if (params.album?.trim()) queryParts.push(`album:${params.album.trim()}`)
  if (params.track?.trim()) queryParts.push(`track:${params.track.trim()}`)

  // Require at least one search parameter
  if (queryParts.length === 0) {
    throw new Error('At least one search parameter (artist, album, or track) is required')
  }

  // Check cache first
  try {
    const cachedResults = await getCachedSearch(params)
    if (cachedResults !== null) {
      console.log('[SPOTIFY_CACHE_HIT]', JSON.stringify({
        params,
        resultCount: cachedResults.length,
        timestamp: new Date().toISOString(),
      }))
      return cachedResults
    }
  } catch (cacheError) {
    // Cache errors should not block the search
    console.warn('[SPOTIFY_CACHE_ERROR]', cacheError)
  }

  const query = queryParts.join(' ')

  // Initialize Spotify SDK with client credentials
  const sdk = SpotifyApi.withClientCredentials(clientId, clientSecret)

  // Search for tracks
  const results = await sdk.search(query, ['track'], undefined, 20)

  const tracks = results.tracks.items as SpotifyTrack[]

  // Store in cache (fire and forget - don't block on cache writes)
  try {
    await setCachedSearch(params, tracks)
    console.log('[SPOTIFY_CACHE_SET]', JSON.stringify({
      params,
      resultCount: tracks.length,
      timestamp: new Date().toISOString(),
    }))
  } catch (cacheError) {
    // Cache errors should not affect the response
    console.warn('[SPOTIFY_CACHE_WRITE_ERROR]', cacheError)
  }

  return tracks
}
