'use server'

import { getDatabase } from './db'
import { songs as songsTable, type Song } from './schema'
import { eq, and, isNull, isNotNull, sql } from 'drizzle-orm'
import { searchSpotifyTracks, type SpotifyTrack } from './spotify'
import { fixMetadataWithAI, type MetadataFix } from './ai-metadata-fixer'
import { getBestTrackSimilarity } from './track-similarity'
import { mapRowToSong } from './mappers'

export type ActionResult<T> =
  | { success: true } & T
  | { success: false; error: string }

/**
 * Get the first song without a spotify_id
 */
export async function getNextUnmatchedSong(): Promise<
  ActionResult<{ song: Song }>
> {
  try {
    const db = getDatabase()

    const result = await db
      .select()
      .from(songsTable)
      .where(isNull(songsTable.spotify_id))
      .limit(1)

    const row = result[0]

    if (!row) {
      return {
        success: false,
        error: 'No unmatched songs found',
      }
    }

    return {
      success: true,
      song: mapRowToSong(row),
    }
  } catch (error) {
    console.error('Error fetching unmatched song:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get a random song without a spotify_id
 * @param testSongId - Optional song ID to fetch for E2E testing (useful for deterministic tests)
 */
export async function getRandomUnmatchedSong(
  testSongId?: number
): Promise<
  ActionResult<{ song: Song }>
> {
  try {
    const db = getDatabase()

    // Allow tests to request a specific song by ID
    if (testSongId) {
      const result = await db
        .select()
        .from(songsTable)
        .where(eq(songsTable.id, testSongId))
        .limit(1)

      const row = result[0]

      if (!row) {
        return {
          success: false,
          error: `Song with ID ${testSongId} not found`,
        }
      }

      return {
        success: true,
        song: mapRowToSong(row),
      }
    }

    // Normal random selection
    const result = await db
      .select()
      .from(songsTable)
      .where(
        and(
          isNull(songsTable.spotify_id),
          isNotNull(songsTable.title),
          sql`${songsTable.title} != ''`
        )
      )
      .orderBy(sql`RANDOM()`)
      .limit(1)

    const row = result[0]

    if (!row) {
      return {
        success: false,
        error: 'No unmatched songs found',
      }
    }

    return {
      success: true,
      song: mapRowToSong(row),
    }
  } catch (error) {
    console.error('Error fetching random unmatched song:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get all songs by a specific artist, sorted by album
 */
export async function getSongsByArtist(
  artist: string | null
): Promise<ActionResult<{ songs: Song[] }>> {
  try {
    const db = getDatabase()

    const rows = await db
      .select()
      .from(songsTable)
      .where(
        and(
          artist ? eq(songsTable.artist, artist) : isNull(songsTable.artist),
          isNotNull(songsTable.title),
          sql`${songsTable.title} != ''`
        )
      )
      .orderBy(songsTable.album, songsTable.title)

    return {
      success: true,
      songs: rows.map(mapRowToSong),
    }
  } catch (error) {
    console.error('Error fetching songs by artist:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Search Spotify for tracks by artist and album
 */
export async function searchSpotifyByArtistAlbum(
  artist: string | null,
  album: string | null
): Promise<ActionResult<{ tracks: SpotifyTrack[] }>> {
  try {
    const tracks = await searchSpotifyTracks({
      artist: artist || undefined,
      album: album || undefined
    })

    return {
      success: true,
      tracks,
    }
  } catch (error) {
    console.error('Error searching Spotify:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get all songs for a specific artist and album
 */
export async function getSongsByAlbum(
  artist: string | null,
  album: string | null
): Promise<ActionResult<{ songs: Song[] }>> {
  try {
    const db = getDatabase()

    const rows = await db
      .select()
      .from(songsTable)
      .where(
        and(
          artist ? eq(songsTable.artist, artist) : isNull(songsTable.artist),
          album ? eq(songsTable.album, album) : isNull(songsTable.album)
        )
      )
      .orderBy(songsTable.title)

    return {
      success: true,
      songs: rows.map(mapRowToSong),
    }
  } catch (error) {
    console.error('Error fetching songs by album:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get the next unmatched album (artist + album of first unmatched song)
 */
export async function getNextUnmatchedAlbum(): Promise<
  ActionResult<{ artist: string | null; album: string | null }>
> {
  try {
    const db = getDatabase()

    const results = await db
      .select()
      .from(songsTable)
      .where(isNull(songsTable.spotify_id))
      .limit(1)

    const result = results[0]

    if (!result) {
      return {
        success: false,
        error: 'No unmatched albums found',
      }
    }

    return {
      success: true,
      artist: result.artist,
      album: result.album,
    }
  } catch (error) {
    console.error('Error fetching unmatched album:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Search Spotify for a specific song.
 * First tries artist+track search for precision. If no results or
 * best match similarity is below 50%, falls back to track-only search
 * for broader coverage.
 */
export async function searchSpotifyForSong(
  artist: string | null,
  album: string | null,
  track: string | null
): Promise<ActionResult<{ tracks: SpotifyTrack[] }>> {
  try {
    // If no artist, go straight to track-only search
    if (!artist) {
      const tracks = await searchSpotifyTracks({
        track: track || undefined,
      })
      return { success: true, tracks }
    }

    // First try: artist + track search for precision
    const artistTrackResults = await searchSpotifyTracks({
      artist,
      track: track || undefined,
    })

    // Check if we got good results
    const bestSimilarity = getBestTrackSimilarity(artistTrackResults, { artist, title: track, album })

    // If we have results with similarity >= 50%, use them
    if (artistTrackResults.length > 0 && bestSimilarity >= 50) {
      return { success: true, tracks: artistTrackResults }
    }

    // Fallback: track-only search for broader coverage
    const trackOnlyResults = await searchSpotifyTracks({
      track: track || undefined,
    })

    return { success: true, tracks: trackOnlyResults }
  } catch (error) {
    console.error('[SEARCH_SONG_ERROR]', JSON.stringify({
      localSong: {
        artist,
        album,
        track,
      },
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }))
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Save a Spotify ID match for a song
 */
export async function saveSongMatch(
  songId: number,
  spotifyId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const db = getDatabase()

    // Check if song exists
    const existingSongs = await db
      .select()
      .from(songsTable)
      .where(eq(songsTable.id, songId))
      .limit(1)

    if (existingSongs.length === 0) {
      return {
        success: false,
        error: `Song with ID ${songId} not found`,
      }
    }

    // Update the spotify_id
    await db
      .update(songsTable)
      .set({ spotify_id: spotifyId })
      .where(eq(songsTable.id, songId))

    return { success: true }
  } catch (error) {
    console.error('Error saving song match:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Clear/undo a Spotify ID match for a song
 */
export async function clearSongMatch(
  songId: number
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const db = getDatabase()

    // Check if song exists
    const existingSongs = await db
      .select()
      .from(songsTable)
      .where(eq(songsTable.id, songId))
      .limit(1)

    if (existingSongs.length === 0) {
      return {
        success: false,
        error: `Song with ID ${songId} not found`,
      }
    }

    // Clear the spotify_id
    await db
      .update(songsTable)
      .set({ spotify_id: null })
      .where(eq(songsTable.id, songId))

    return { success: true }
  } catch (error) {
    console.error('Error clearing song match:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get AI-powered metadata fix suggestions for a song
 */
export async function getAISuggestionForSong(
  songId: number
): Promise<ActionResult<{ suggestion: MetadataFix; song: Song }>> {
  try {
    const db = getDatabase()

    // Fetch the song
    const songs = await db
      .select()
      .from(songsTable)
      .where(eq(songsTable.id, songId))
      .limit(1)

    if (songs.length === 0) {
      return {
        success: false,
        error: `Song with ID ${songId} not found`,
      }
    }

    const song = mapRowToSong(songs[0])

    // Get AI suggestion
    const suggestion = await fixMetadataWithAI(song)

    if (!suggestion) {
      return {
        success: false,
        error: 'AI service is unavailable or returned invalid response',
      }
    }

    return {
      success: true,
      suggestion,
      song,
    }
  } catch (error) {
    console.error('Error getting AI suggestion:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Apply AI-suggested metadata fixes to a song in the database
 */
export async function applyAIFixToSong(
  songId: number,
  fix: MetadataFix
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const db = getDatabase()

    // Check if song exists
    const existingSongs = await db
      .select()
      .from(songsTable)
      .where(eq(songsTable.id, songId))
      .limit(1)

    if (existingSongs.length === 0) {
      return {
        success: false,
        error: `Song with ID ${songId} not found`,
      }
    }

    // Apply the fixes
    await db
      .update(songsTable)
      .set({
        artist: fix.suggestedArtist,
        title: fix.suggestedTrack,
        album: fix.suggestedAlbum || existingSongs[0].album,
      })
      .where(eq(songsTable.id, songId))

    return { success: true }
  } catch (error) {
    console.error('Error applying AI fix:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
