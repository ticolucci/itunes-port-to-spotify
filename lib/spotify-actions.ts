'use server'

import { getDatabase } from './db'
import type { Song } from './types'
import { getSpotifyClient, type SpotifyApiTrack } from './spotify'

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
 * Search Spotify for tracks by artist and album (with memoization)
 */
export async function searchSpotifyByArtistAlbum(
  artist: string,
  album: string
): Promise<ActionResult<{ tracks: SpotifyApiTrack[] }>> {
  try {
    const db = getDatabase()
    const spotifyClient = getSpotifyClient(db)
    const tracks = await spotifyClient.searchTracks({ artist, album })

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
