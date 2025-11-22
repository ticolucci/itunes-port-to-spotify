import type { SpotifyTrack } from './spotify'
import { calculateEnhancedSimilarity, type SongMetadata } from './enhanced-similarity'

/**
 * A Spotify track paired with its calculated similarity score.
 */
export interface TrackWithSimilarity {
  track: SpotifyTrack
  similarity: number
}

/**
 * Calculates similarity scores for a list of Spotify tracks compared to local song metadata.
 *
 * @param tracks - Array of Spotify tracks to compare
 * @param localSong - Local song metadata to compare against
 * @returns Array of tracks with their similarity scores (unsorted)
 */
export function calculateTracksWithSimilarity(
  tracks: SpotifyTrack[],
  localSong: SongMetadata
): TrackWithSimilarity[] {
  return tracks.map((track) => ({
    track,
    similarity: calculateEnhancedSimilarity(localSong, {
      artist: track.artists[0]?.name || null,
      title: track.name,
      album: track.album.name,
    }),
  }))
}

/**
 * Gets the highest similarity score from a list of Spotify tracks.
 *
 * @param tracks - Array of Spotify tracks to compare
 * @param localSong - Local song metadata to compare against
 * @returns The highest similarity score (0-100), or 0 if tracks array is empty
 */
export function getBestTrackSimilarity(
  tracks: SpotifyTrack[],
  localSong: SongMetadata
): number {
  if (tracks.length === 0) return 0

  const tracksWithSimilarity = calculateTracksWithSimilarity(tracks, localSong)
  return Math.max(...tracksWithSimilarity.map((t) => t.similarity))
}

/**
 * Sorts tracks by similarity in descending order (best matches first).
 * Returns a new array without mutating the input.
 *
 * @param tracksWithSimilarity - Array of tracks with similarity scores
 * @returns New array sorted by similarity (descending)
 */
export function sortTracksBySimilarity(
  tracksWithSimilarity: TrackWithSimilarity[]
): TrackWithSimilarity[] {
  return [...tracksWithSimilarity].sort((a, b) => b.similarity - a.similarity)
}
