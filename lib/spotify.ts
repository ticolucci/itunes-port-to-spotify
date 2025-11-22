import { SpotifyApi } from '@spotify/web-api-ts-sdk'
import { getCachedSearch, setCachedSearch } from './spotify-cache'

/**
 * Escape special characters from Spotify search queries.
 * Spotify search has special syntax characters that can break searches:
 * - " (quotes) - used for exact phrase matching
 * - : (colon) - used as field separator (artist:, album:, track:)
 * - * (asterisk) - used as wildcard
 * - ! (exclamation) - negation
 * - $ (dollar) - special meaning
 * - () [] - grouping
 *
 * @param value - The raw string value to escape
 * @returns The escaped string safe for Spotify search, or empty string for invalid input
 */
export function escapeSpotifyQuery(value: string): string {
  if (!value || typeof value !== 'string') {
    return ''
  }

  let escaped = value.trim()
  if (!escaped) {
    return ''
  }

  // Remove characters that have special meaning in Spotify search
  escaped = escaped
    .replace(/["]/g, '')       // Remove double quotes (exact phrase)
    .replace(/[:]/g, ' ')      // Replace colons with space (field separator)
    .replace(/[*]/g, '')       // Remove asterisks (wildcards)
    .replace(/[!]/g, '')       // Remove exclamation marks (negation)
    .replace(/[$]/g, '')       // Remove dollar signs
    .replace(/[()[\]]/g, '')   // Remove parentheses and brackets

  // Normalize multiple spaces to single space
  escaped = escaped.replace(/\s+/g, ' ').trim()

  return escaped
}

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
  // Filter out null/empty values, escape special characters, and trim whitespace
  const queryParts: string[] = []
  const escapedArtist = escapeSpotifyQuery(params.artist || '')
  const escapedAlbum = escapeSpotifyQuery(params.album || '')
  const escapedTrack = escapeSpotifyQuery(params.track || '')

  if (escapedArtist) queryParts.push(`artist:${escapedArtist}`)
  if (escapedAlbum) queryParts.push(`album:${escapedAlbum}`)
  if (escapedTrack) queryParts.push(`track:${escapedTrack}`)

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
