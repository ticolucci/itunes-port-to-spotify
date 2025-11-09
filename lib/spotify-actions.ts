'use server'

import { getDatabase } from './db'
import { songs as songsTable, type Song } from './schema'
import { eq, and, isNull } from 'drizzle-orm'
import { searchSpotifyTracks, type SpotifyTrack } from './spotify'

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

    const song: Song = {
      id: row.id,
      title: row.title,
      artist: row.artist,
      album: row.album,
      album_artist: row.album_artist,
      filename: row.filename,
      spotify_id: row.spotify_id,
    }

    return {
      success: true,
      song,
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
      .where(artist ? eq(songsTable.artist, artist) : isNull(songsTable.artist))
      .orderBy(songsTable.album, songsTable.title)

    const songs: Song[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      artist: row.artist,
      album: row.album,
      album_artist: row.album_artist,
      filename: row.filename,
      spotify_id: row.spotify_id,
    }))

    return {
      success: true,
      songs,
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

    const songs: Song[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      artist: row.artist,
      album: row.album,
      album_artist: row.album_artist,
      filename: row.filename,
      spotify_id: row.spotify_id,
    }))

    return {
      success: true,
      songs,
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
 * Search Spotify for a specific song
 */
export async function searchSpotifyForSong(
  artist: string | null,
  album: string | null,
  track: string | null
): Promise<ActionResult<{ tracks: SpotifyTrack[] }>> {
  try {
    const tracks = await searchSpotifyTracks({
      artist: artist || undefined,
      album: album || undefined,
      track: track || undefined
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
