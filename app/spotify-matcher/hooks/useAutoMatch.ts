import { useState, useCallback, useRef, useEffect } from 'react'
import type { SpotifyTrack } from '@/lib/spotify'
import type { SongWithMatch } from '@/lib/song-matcher-utils'
import { getEligibleAutoMatchSongs } from '@/lib/song-matcher-utils'
import { saveSongMatch } from '@/lib/spotify-actions'
import type { SongsAction } from '../state/songsReducer'

interface UseAutoMatchOptions {
  songsWithMatches: SongWithMatch[]
  matchingIds: Set<number>
  dispatchSongs: React.Dispatch<SongsAction>
}

interface UseAutoMatchResult {
  autoMatchEnabled: boolean
  setAutoMatchEnabled: (enabled: boolean) => void
  attemptAutoMatchAndUpdateState: (
    songId: number,
    spotifyMatch: SpotifyTrack,
    similarity: number,
    allMatches?: Array<{ track: SpotifyTrack; similarity: number }>
  ) => Promise<boolean>
}

export function useAutoMatch({
  songsWithMatches,
  matchingIds,
  dispatchSongs,
}: UseAutoMatchOptions): UseAutoMatchResult {
  const [autoMatchEnabled, setAutoMatchEnabled] = useState(false)
  const processedAutoMatches = useRef<Set<number>>(new Set())
  const autoMatchInProgress = useRef(false)

  /**
   * Attempts to save an auto-match to the database.
   * Returns the spotify ID if successful, null otherwise.
   */
  const attemptAutoMatch = useCallback(
    async (songId: number, spotifyId: string, similarity: number): Promise<string | null> => {
      if (!autoMatchEnabled || similarity < 80) return null

      const matchResult = await saveSongMatch(songId, spotifyId)
      if (!matchResult.success) return null

      return spotifyId
    },
    [autoMatchEnabled]
  )

  /**
   * Attempts to auto-match a song with its Spotify match and updates state.
   * Returns true if match was successful, false otherwise.
   */
  const attemptAutoMatchAndUpdateState = useCallback(
    async (
      songId: number,
      spotifyMatch: SpotifyTrack,
      similarity: number,
      allMatches?: Array<{ track: SpotifyTrack; similarity: number }>
    ): Promise<boolean> => {
      const spotifyId = await attemptAutoMatch(songId, spotifyMatch.id, similarity)
      if (!spotifyId) return false

      // Update state using reducer action
      dispatchSongs({
        type: 'AUTO_MATCH',
        payload: { songId, spotifyMatch, similarity, spotifyId, allMatches }
      })

      return true
    },
    [attemptAutoMatch, dispatchSongs]
  )

  // Auto-match existing search results when toggle is enabled
  useEffect(() => {
    if (!autoMatchEnabled) return

    async function autoMatchEligibleSongs() {
      // Prevent race conditions - only one auto-match process at a time
      if (autoMatchInProgress.current) return
      autoMatchInProgress.current = true

      try {
        // Filter songs we haven't processed yet
        const eligibleSongs = getEligibleAutoMatchSongs(
          songsWithMatches,
          matchingIds,
          processedAutoMatches.current
        )

        // Mark as processed BEFORE async operations to prevent duplicates
        eligibleSongs.forEach((s) => processedAutoMatches.current.add(s.dbSong.id))

        // Collect all successful matches
        const matchResults = new Map<number, { spotifyMatch: SpotifyTrack; similarity: number }>()

        await Promise.all(eligibleSongs.map(async (songWithMatch) => {
          const spotifyId = await attemptAutoMatch(
            songWithMatch.dbSong.id,
            songWithMatch.spotifyMatch!.id,
            songWithMatch.similarity
          )
          if (spotifyId) {
            matchResults.set(songWithMatch.dbSong.id, {
              spotifyMatch: songWithMatch.spotifyMatch!,
              similarity: songWithMatch.similarity,
            })
          }
        }))

        // Single batched state update for all successful matches
        if (matchResults.size > 0) {
          dispatchSongs({ type: 'BATCH_MATCH', payload: matchResults })
        }
      } finally {
        autoMatchInProgress.current = false
      }
    }

    autoMatchEligibleSongs()
  }, [autoMatchEnabled, songsWithMatches, matchingIds, attemptAutoMatch, dispatchSongs])

  // Reset processed matches when auto-match is toggled off
  const handleSetAutoMatchEnabled = useCallback((enabled: boolean) => {
    if (!enabled) {
      processedAutoMatches.current.clear()
    }
    setAutoMatchEnabled(enabled)
  }, [])

  return {
    autoMatchEnabled,
    setAutoMatchEnabled: handleSetAutoMatchEnabled,
    attemptAutoMatchAndUpdateState,
  }
}
