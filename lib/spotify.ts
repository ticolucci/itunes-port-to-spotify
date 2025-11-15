import { SpotifyApi } from '@spotify/web-api-ts-sdk'

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
 * Search Spotify tracks using artist, album, and/or track name
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

  const query = queryParts.join(' ')

  // Log search request for Vercel debugging
  console.log('[SPOTIFY_SEARCH_REQUEST]', JSON.stringify({
    input: {
      artist: params.artist || null,
      album: params.album || null,
      track: params.track || null,
    },
    query,
    timestamp: new Date().toISOString(),
  }))

  // Initialize Spotify SDK with client credentials
  const sdk = SpotifyApi.withClientCredentials(clientId, clientSecret)

  // Search for tracks
  const results = await sdk.search(query, ['track'], undefined, 20)

  const tracks = results.tracks.items as SpotifyTrack[]

  // Log search response for Vercel debugging
  console.log('[SPOTIFY_SEARCH_RESPONSE]', JSON.stringify({
    query,
    totalResults: tracks.length,
    topResults: tracks.slice(0, 5).map(t => ({
      name: t.name,
      artist: t.artists[0]?.name || null,
      album: t.album.name,
      id: t.id,
    })),
    timestamp: new Date().toISOString(),
  }))

  return tracks
}
