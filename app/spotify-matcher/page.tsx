'use client'

import { useEffect, useCallback, useReducer } from 'react'
import { Loader2, Check } from 'lucide-react'
import type { Song } from '@/lib/schema'
import type { SpotifyTrack } from '@/lib/spotify'
import {
  getRandomUnmatchedSong,
  getSongsByArtist,
  searchSpotifyForSong,
  saveSongMatch,
  clearSongMatch,
} from '@/lib/spotify-actions'
import { ReviewCard } from './ReviewCard'
import { SongTableRow } from './components/SongTableRow'
import { ArtistHeader } from './components/ArtistHeader'
import { calculateEnhancedSimilarity } from '@/lib/enhanced-similarity'
import {
  shouldSkipSong,
  createInitialSongs,
  getEligibleAutoMatchSongs,
  findNextReviewableIndex,
} from '@/lib/song-matcher-utils'
import { matcherReducer, initialMatcherState } from './state/matcherReducer'

export default function SpotifyMatcherPage() {
  const [state, dispatch] = useReducer(matcherReducer, initialMatcherState)

  const {
    currentArtist,
    songs: songsWithMatches,
    loading,
    error,
    matchingIds,
    currentReviewIndex,
    autoMatchEnabled,
    processedAutoMatches,
    autoMatchInProgress,
    debugInfo,
  } = state

  const loadRandomArtist = useCallback(async () => {
    try {
      dispatch({ type: 'LOAD_ARTIST_START' })

      // Check for song ID query param (songId or test_song_id for E2E testing)
      const params = new URLSearchParams(window.location.search)
      const songId = params.get('songId') || params.get('test_song_id')

      // 1. Get a random unmatched song (or specific song if ID provided)
      const randomSongResult = await getRandomUnmatchedSong(
        songId ? parseInt(songId, 10) : undefined
      )

      if (!randomSongResult.success) {
        dispatch({ type: 'LOAD_ARTIST_ERROR', payload: { error: randomSongResult.error } })
        return
      }

      const randomSong = randomSongResult.song

      // 2. Get all songs by this artist
      const songsResult = await getSongsByArtist(randomSong.artist)

      if (!songsResult.success) {
        dispatch({ type: 'LOAD_ARTIST_ERROR', payload: { error: songsResult.error } })
        return
      }

      // 3. Initialize songs with empty matches
      const initialSongs = createInitialSongs(songsResult.songs)

      dispatch({
        type: 'LOAD_ARTIST_SUCCESS',
        payload: { artist: randomSong.artist, songs: initialSongs },
      })

      // 4. Search for Spotify matches for each unmatched song
      songsResult.songs.forEach((song: Song) => {
        if (!song.spotify_id) {
          searchForMatch(song)
        }
      })
    } catch (err) {
      console.error('Error loading artist:', err)
      dispatch({
        type: 'LOAD_ARTIST_ERROR',
        payload: { error: err instanceof Error ? err.message : 'Unknown error' },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only run on mount, searchForMatch is stable
  }, [])

  useEffect(() => {
    loadRandomArtist()
  }, [loadRandomArtist])

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
  async function attemptAutoMatchAndUpdateState(
    songId: number,
    spotifyMatch: SpotifyTrack,
    similarity: number,
    allMatches?: Array<{ track: SpotifyTrack; similarity: number }>
  ): Promise<boolean> {
    const spotifyId = await attemptAutoMatch(songId, spotifyMatch.id, similarity)
    if (!spotifyId) return false

    // Update state using reducer action
    dispatch({
      type: 'AUTO_MATCH_SONG',
      payload: { songId, spotifyMatch, similarity, spotifyId, allMatches },
    })

    return true
  }

  // Auto-match existing search results when toggle is enabled
  useEffect(() => {
    if (!autoMatchEnabled) return

    async function autoMatchEligibleSongs() {
      // Prevent race conditions - only one auto-match process at a time
      if (autoMatchInProgress) return
      dispatch({ type: 'SET_AUTO_MATCH_IN_PROGRESS', payload: true })

      try {
        // Filter songs we haven't processed yet
        const eligibleSongs = getEligibleAutoMatchSongs(
          songsWithMatches,
          matchingIds,
          processedAutoMatches
        )

        // Mark as processed BEFORE async operations to prevent duplicates
        if (eligibleSongs.length > 0) {
          dispatch({
            type: 'ADD_PROCESSED_AUTO_MATCHES',
            payload: eligibleSongs.map((s) => s.dbSong.id),
          })
        }

        // Collect all successful matches
        const matchResults = new Map<number, { spotifyMatch: SpotifyTrack; similarity: number }>()

        await Promise.all(
          eligibleSongs.map(async (songWithMatch) => {
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
          })
        )

        // Single batched state update for all successful matches
        if (matchResults.size > 0) {
          dispatch({ type: 'BATCH_MATCH_SONGS', payload: matchResults })
        }
      } finally {
        dispatch({ type: 'SET_AUTO_MATCH_IN_PROGRESS', payload: false })
      }
    }

    autoMatchEligibleSongs()
  }, [autoMatchEnabled, songsWithMatches, matchingIds, processedAutoMatches, autoMatchInProgress, attemptAutoMatch])

  async function searchForMatch(song: Song) {
    // Skip songs without titles (defensive check)
    if (shouldSkipSong(song)) {
      return
    }

    // Update searching state
    dispatch({ type: 'SET_SONG_SEARCHING', payload: { songId: song.id, searching: true } })

    try {
      const result = await searchSpotifyForSong(song.artist, song.album, song.title)

      if (result.success && result.tracks.length > 0) {
        // Calculate enhanced similarity for ALL results and sort by best match
        const tracksWithSimilarity = result.tracks.map((track) => ({
          track,
          similarity: calculateEnhancedSimilarity(
            {
              artist: song.artist,
              title: song.title,
              album: song.album,
            },
            {
              artist: track.artists[0]?.name || null,
              title: track.name,
              album: track.album.name,
            }
          ),
        }))

        // Sort by similarity (descending) - best matches first
        tracksWithSimilarity.sort((a, b) => b.similarity - a.similarity)

        // DEBUG: Log search results with similarity scores
        console.log(
          '[SPOTIFY RESULTS]',
          JSON.stringify({
            totalTracks: tracksWithSimilarity.length,
            top5: tracksWithSimilarity.slice(0, 5).map((t) => ({
              name: t.track.name,
              artist: t.track.artists[0]?.name,
              album: t.track.album.name,
              similarity: t.similarity,
            })),
          })
        )

        // Update debug UI
        dispatch({
          type: 'SET_DEBUG_INFO',
          payload: {
            query: `track:${song.title}`,
            trackCount: tracksWithSimilarity.length,
            topResults: tracksWithSimilarity.slice(0, 3).map((t) => ({
              name: t.track.name,
              artist: t.track.artists[0]?.name || '',
              album: t.track.album.name,
            })),
          },
        })

        // Use best match (highest similarity)
        const bestMatch = tracksWithSimilarity[0].track
        const similarity = tracksWithSimilarity[0].similarity

        // Store all matches for the user to choose from
        const allMatches = tracksWithSimilarity.map((t) => ({
          track: t.track,
          similarity: t.similarity,
        }))

        // DEBUG: Log best match
        console.log(
          '[BEST MATCH]',
          JSON.stringify({
            local: { artist: song.artist, title: song.title, album: song.album },
            spotify: {
              artist: bestMatch.artists[0]?.name,
              title: bestMatch.name,
              album: bestMatch.album.name,
            },
            similarity,
          })
        )

        // Try auto-match (will only succeed if enabled and similarity >= 80%)
        const wasAutoMatched = await attemptAutoMatchAndUpdateState(
          song.id,
          bestMatch,
          similarity,
          allMatches
        )

        // If not auto-matched, update state with manual match option
        if (!wasAutoMatched) {
          dispatch({
            type: 'UPDATE_SONG_MATCH',
            payload: { songId: song.id, spotifyMatch: bestMatch, similarity, allMatches },
          })
        }
      } else {
        console.log(
          '[NO MATCH]',
          JSON.stringify({ songId: song.id, artist: song.artist, title: song.title })
        )
        dispatch({ type: 'SET_SONG_SEARCHING', payload: { songId: song.id, searching: false } })
      }
    } catch (err) {
      console.error('Error searching for match:', JSON.stringify(err))
      dispatch({ type: 'SET_SONG_SEARCHING', payload: { songId: song.id, searching: false } })
    }
  }

  async function handleMatch(songId: number, spotifyId: string) {
    try {
      dispatch({ type: 'ADD_MATCHING_ID', payload: songId })

      const result = await saveSongMatch(songId, spotifyId)

      if (!result.success) {
        alert(`Error: ${result.error}`)
        dispatch({ type: 'REMOVE_MATCHING_ID', payload: songId })
        return
      }

      // Update local state to mark as matched
      dispatch({ type: 'MARK_SONG_MATCHED', payload: { songId, spotifyId } })
      dispatch({ type: 'REMOVE_MATCHING_ID', payload: songId })
    } catch (err) {
      console.error('Error saving match:', err)
      alert('Failed to save match')
      dispatch({ type: 'REMOVE_MATCHING_ID', payload: songId })
    }
  }

  async function handleReviewMatch(songId: number, spotifyId: string) {
    await handleMatch(songId, spotifyId)
    // Move to next song in review
    dispatch({ type: 'INCREMENT_REVIEW_INDEX' })
  }

  function handleSkip() {
    // Just move to next song without saving
    dispatch({ type: 'INCREMENT_REVIEW_INDEX' })
  }

  async function handleUndo(songId: number) {
    try {
      dispatch({ type: 'ADD_MATCHING_ID', payload: songId })

      const result = await clearSongMatch(songId)

      if (!result.success) {
        alert(`Error: ${result.error}`)
        dispatch({ type: 'REMOVE_MATCHING_ID', payload: songId })
        return
      }

      // Update local state to mark as unmatched
      dispatch({ type: 'CLEAR_SONG_MATCH', payload: { songId } })
      dispatch({ type: 'REMOVE_MATCHING_ID', payload: songId })
    } catch (err) {
      console.error('Error undoing match:', err)
      alert('Failed to undo match')
      dispatch({ type: 'REMOVE_MATCHING_ID', payload: songId })
    }
  }

  function handleSongUpdate(
    songId: number,
    update: { artist: string; title: string; album: string | null }
  ) {
    dispatch({
      type: 'UPDATE_SONG_METADATA',
      payload: { songId, ...update },
    })
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Loading artist songs...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="border border-destructive rounded-lg p-6 bg-destructive/10">
          <h2 className="text-xl font-semibold text-destructive mb-2">Error</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (songsWithMatches.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">All Songs Matched!</h1>
          <p className="text-muted-foreground">No unmatched songs found.</p>
        </div>
      </div>
    )
  }

  const matchedCount = songsWithMatches.filter((s) => s.isMatched).length
  const totalCount = songsWithMatches.length

  // Find the next reviewable song starting from the current index
  const reviewableIndex = findNextReviewableIndex(songsWithMatches, currentReviewIndex)
  const currentReview = reviewableIndex >= 0 ? songsWithMatches[reviewableIndex] : null
  const hasMoreToReview = reviewableIndex >= 0

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-bold">Spotify Matcher</h1>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoMatchEnabled}
            onChange={(e) => dispatch({ type: 'SET_AUTO_MATCH_ENABLED', payload: e.target.checked })}
            aria-label="Auto-match songs with similarity >= 80%"
            className="w-4 h-4"
          />
          <span className="text-sm">Auto-match (≥80%)</span>
        </label>
      </div>
      <p className="text-muted-foreground mb-8">Match your iTunes songs with Spotify tracks</p>

      {/* DEBUG PANEL */}
      {debugInfo && (
        <div
          data-testid="debug-panel"
          className="mb-8 p-4 border-2 border-yellow-300 rounded-lg bg-yellow-50"
        >
          <h3 className="font-bold text-yellow-900 mb-2">DEBUG: Spotify Search</h3>
          <div className="text-sm space-y-2">
            <div>
              <span className="font-semibold">Query:</span>{' '}
              <code className="bg-yellow-100 px-1">{debugInfo.query}</code>
            </div>
            <div>
              <span className="font-semibold">Results Found:</span> {debugInfo.trackCount}
            </div>
            {debugInfo.topResults.length > 0 && (
              <div>
                <span className="font-semibold">Top 3 Results:</span>
                <ul className="list-disc ml-6 mt-1">
                  {debugInfo.topResults.map((track, idx) => (
                    <li key={idx}>
                      <strong>{track.name}</strong> by {track.artist} ({track.album})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {debugInfo.trackCount === 0 && (
              <div className="text-red-700 font-semibold">
                NO RESULTS - Search may be too restrictive!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tinder-style Review Card */}
      {hasMoreToReview && currentReview && (
        <ReviewCard
          currentReview={currentReview}
          currentIndex={reviewableIndex}
          totalCount={songsWithMatches.length}
          isMatching={matchingIds.has(currentReview.dbSong.id)}
          onMatch={handleReviewMatch}
          onSkip={handleSkip}
        />
      )}

      {/* Review Complete Message */}
      {!hasMoreToReview && (
        <div className="mb-8 p-6 border-2 border-green-200 rounded-lg bg-green-50 text-center">
          <Check className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <p className="font-semibold text-green-900">Review Complete!</p>
          <p className="text-sm text-green-700">
            All songs have been reviewed. You can still use the table below to make changes.
          </p>
        </div>
      )}

      {/* Artist Header */}
      <ArtistHeader
        artist={currentArtist}
        matchedCount={matchedCount}
        totalCount={totalCount}
        onLoadRandomArtist={loadRandomArtist}
      />

      {/* Songs Table */}
      <div className="space-y-3">
        {songsWithMatches.map((songWithMatch) => (
          <SongTableRow
            key={songWithMatch.dbSong.id}
            songWithMatch={songWithMatch}
            isMatching={matchingIds.has(songWithMatch.dbSong.id)}
            onMatch={handleMatch}
            onUndo={handleUndo}
            onSongUpdate={handleSongUpdate}
          />
        ))}
      </div>
    </div>
  )
}
