import { SpotifyApi } from '@spotify/web-api-ts-sdk'

export interface SpotifyTrack {
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
  const queryParts: string[] = []
  if (params.artist) queryParts.push(`artist:${params.artist}`)
  if (params.album) queryParts.push(`album:${params.album}`)
  if (params.track) queryParts.push(`track:${params.track}`)

  const query = queryParts.join(' ')

  // Initialize Spotify SDK with client credentials
  const sdk = SpotifyApi.withClientCredentials(clientId, clientSecret)

  // Search for tracks
  const results = await sdk.search(query, ['track'], undefined, 20)

  return results.tracks.items as SpotifyTrack[]
}
