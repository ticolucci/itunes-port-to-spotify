import type { Song } from './schema'

/**
 * Row type that represents a database row that can be mapped to a Song.
 * This matches the shape returned by Drizzle ORM select queries.
 */
export type SongRow = {
  id: number
  title: string | null
  artist: string | null
  album: string | null
  album_artist: string | null
  filename: string | null
  spotify_id: string | null
}

/**
 * Maps a database row to a Song object.
 *
 * This utility function provides a single source of truth for converting
 * database rows to Song objects, eliminating duplicated mapping logic
 * throughout the codebase.
 *
 * @param row - The database row from a Drizzle ORM select query
 * @returns A Song object with all fields mapped from the row
 */
export function mapRowToSong(row: SongRow): Song {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    album_artist: row.album_artist,
    filename: row.filename,
    spotify_id: row.spotify_id,
  }
}
