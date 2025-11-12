import type { Song } from './schema'
import type { SpotifyTrack } from './spotify'

export interface SongWithMatch {
  dbSong: Song
  spotifyMatch: SpotifyTrack | null
  similarity: number
  isMatched: boolean
  searching: boolean
}

/**
 * Determines if a song should be skipped from matching due to missing title.
 */
export function shouldSkipSong(song: Song): boolean {
  return !song.title || song.title.trim() === ''
}

/**
 * Checks if a song has incomplete metadata (missing title, artist, or album).
 */
export function hasIncompleteMetadata(song: Song): boolean {
  return !song.title || !song.artist || !song.album
}

/**
 * Determines if a song is eligible for auto-matching based on:
 * - Has a Spotify match
 * - Similarity >= 80%
 * - Not already matched
 * - Not currently being matched
 * - Not already processed
 */
export function isEligibleForAutoMatch(
  songWithMatch: SongWithMatch,
  matchingIds: Set<number>,
  processedAutoMatches: Set<number>
): boolean {
  return (
    !!songWithMatch.spotifyMatch &&
    songWithMatch.similarity >= 80 &&
    !songWithMatch.isMatched &&
    !matchingIds.has(songWithMatch.dbSong.id) &&
    !processedAutoMatches.has(songWithMatch.dbSong.id)
  )
}

/**
 * Determines if auto-match should be attempted based on similarity threshold.
 */
export function shouldAttemptAutoMatch(similarity: number): boolean {
  return similarity >= 80
}

/**
 * Gets count of matched songs from a list.
 */
export function getMatchedCount(songs: SongWithMatch[]): number {
  return songs.filter((s) => s.isMatched).length
}

/**
 * Filters list to only unmatched songs.
 */
export function getUnmatchedSongs(songs: SongWithMatch[]): SongWithMatch[] {
  return songs.filter((s) => !s.isMatched)
}

/**
 * Checks if there are more songs to review based on current index.
 */
export function hasMoreToReview(currentIndex: number, totalSongs: number): boolean {
  return currentIndex < totalSongs
}

/**
 * Creates initial song state from database songs.
 */
export function createInitialSongs(songs: Song[]): SongWithMatch[] {
  return songs.map((song) => ({
    dbSong: song,
    spotifyMatch: null,
    similarity: 0,
    isMatched: !!song.spotify_id,
    searching: false,
  }))
}

/**
 * Filters songs eligible for auto-matching.
 */
export function getEligibleAutoMatchSongs(
  songs: SongWithMatch[],
  matchingIds: Set<number>,
  processedMatches: Set<number>
): SongWithMatch[] {
  return songs.filter((s) =>
    isEligibleForAutoMatch(s, matchingIds, processedMatches)
  )
}
