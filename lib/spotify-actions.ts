'use server'

import { getDatabase } from './db'
import type { Song } from './types'
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

    const song = db
      .prepare(
        `SELECT id, title, artist, album, album_artist, filename, spotify_id
         FROM songs
         WHERE spotify_id IS NULL
         LIMIT 1`
      )
      .get() as Song | undefined

    if (!song) {
      return {
        success: false,
        error: 'No unmatched songs found',
      }
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
  artist: string
): Promise<ActionResult<{ songs: Song[] }>> {
  try {
    const db = getDatabase()

    const songs = db
      .prepare(
        `SELECT id, title, artist, album, album_artist, filename, spotify_id
         FROM songs
         WHERE artist = ?
         ORDER BY album, title`
      )
      .all(artist) as Song[]

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
  artist: string,
  album: string
): Promise<ActionResult<{ tracks: SpotifyTrack[] }>> {
  try {
    const tracks = await searchSpotifyTracks({ artist, album })

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
  artist: string,
  album: string
): Promise<ActionResult<{ songs: Song[] }>> {
  try {
    const db = getDatabase()

    const songs = db
      .prepare(
        `SELECT id, title, artist, album, album_artist, filename, spotify_id
         FROM songs
         WHERE artist = ? AND album = ?
         ORDER BY title`
      )
      .all(artist, album) as Song[]

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
  ActionResult<{ artist: string; album: string }>
> {
  try {
    const db = getDatabase()

    const result = db
      .prepare(
        `SELECT artist, album
         FROM songs
         WHERE spotify_id IS NULL
         LIMIT 1`
      )
      .get() as { artist: string; album: string } | undefined

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
  artist: string,
  album: string,
  track: string
): Promise<ActionResult<{ tracks: SpotifyTrack[] }>> {
  try {
    const tracks = await searchSpotifyTracks({ artist, album, track })

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
): Promise<ActionResult<{}>> {
  try {
    const db = getDatabase()

    // Check if song exists
    const song = db
      .prepare('SELECT id FROM songs WHERE id = ?')
      .get(songId)

    if (!song) {
      return {
        success: false,
        error: `Song with ID ${songId} not found`,
      }
    }

    // Update the spotify_id
    db.prepare('UPDATE songs SET spotify_id = ? WHERE id = ?').run(
      spotifyId,
      songId
    )

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
): Promise<ActionResult<{}>> {
  try {
    const db = getDatabase()

    // Check if song exists
    const song = db
      .prepare('SELECT id FROM songs WHERE id = ?')
      .get(songId)

    if (!song) {
      return {
        success: false,
        error: `Song with ID ${songId} not found`,
      }
    }

    // Clear the spotify_id
    db.prepare('UPDATE songs SET spotify_id = NULL WHERE id = ?').run(songId)

    return { success: true }
  } catch (error) {
    console.error('Error clearing song match:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
