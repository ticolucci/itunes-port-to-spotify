'use client'

import { useState, useEffect, useCallback, useRef, useReducer } from 'react'
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
import { calculateSimilarity } from '@/lib/similarity'
import { calculateEnhancedSimilarity } from '@/lib/enhanced-similarity'
import {
  shouldSkipSong,
  createInitialSongs,
  getEligibleAutoMatchSongs,
} from '@/lib/song-matcher-utils'
import { songsReducer } from './state/songsReducer'

interface DebugInfo {
  query: string
  trackCount: number
  topResults: Array<{ name: string; artist: string; album: string }>
}

export default function SpotifyMatcherPage() {
  const [currentArtist, setCurrentArtist] = useState<string | null>(null)
  const [songsWithMatches, dispatchSongs] = useReducer(songsReducer, [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [matchingIds, setMatchingIds] = useState<Set<number>>(new Set())
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0)
  const [autoMatchEnabled, setAutoMatchEnabled] = useState(false)
  const processedAutoMatches = useRef<Set<number>>(new Set())
  const autoMatchInProgress = useRef(false)
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)

  const loadRandomArtist = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      processedAutoMatches.current.clear() // Reset tracking when loading new artist

      // Check for test mode query param (for E2E testing)
      const params = new URLSearchParams(window.location.search)
      const testSongId = params.get('test_song_id')

      // 1. Get a random unmatched song (or specific test song)
      const randomSongResult = await getRandomUnmatchedSong(
        testSongId ? parseInt(testSongId, 10) : undefined
      )

      if (!randomSongResult.success) {
        setError(randomSongResult.error)
        setLoading(false)
        return
      }

      const randomSong = randomSongResult.song
      setCurrentArtist(randomSong.artist)

      // 2. Get all songs by this artist
      const songsResult = await getSongsByArtist(randomSong.artist)

      if (!songsResult.success) {
        setError(songsResult.error)
        setLoading(false)
        return
      }

      // 3. Initialize songs with empty matches
      const initialSongs = createInitialSongs(songsResult.songs)

      dispatchSongs({ type: 'SET_SONGS', payload: initialSongs })
      setLoading(false)
      setCurrentReviewIndex(0) // Reset review index

      // 4. Search for Spotify matches for each unmatched song
      songsResult.songs.forEach((song: Song) => {
        if (!song.spotify_id) {
          searchForMatch(song)
        }
      })
        } catch (err) {
      console.error('Error loading artist:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
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
    similarity: number
  ): Promise<boolean> {
    const spotifyId = await attemptAutoMatch(songId, spotifyMatch.id, similarity)
    if (!spotifyId) return false

    // Update state using reducer action
    dispatchSongs({
      type: 'AUTO_MATCH',
      payload: { songId, spotifyMatch, similarity, spotifyId }
    })

    return true
  }

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
  }, [autoMatchEnabled, songsWithMatches, matchingIds, attemptAutoMatch])

  async function searchForMatch(song: Song) {
    // Skip songs without titles (defensive check)
    if (shouldSkipSong(song)) {
      return
    }

    // Update searching state
    dispatchSongs({ type: 'SET_SEARCHING', payload: { songId: song.id, searching: true } })

    try {
      // DEBUG: Log search params
      console.log('[SPOTIFY SEARCH]', {
        artist: song.artist,
        album: song.album,
        title: song.title,
        query: `track:${song.title}` // Now using track-only search
      })

      const result = await searchSpotifyForSong(song.artist, song.album, song.title)

      if (result.success && result.tracks.length > 0) {
        // Calculate enhanced similarity for ALL results and sort by best match
        const tracksWithSimilarity = result.tracks.map(track => ({
          track,
          similarity: calculateEnhancedSimilarity(
            {
              artist: song.artist,
              title: song.title,
              album: song.album
            },
            {
              artist: track.artists[0]?.name || null,
              title: track.name,
              album: track.album.name
            }
          )
        }))

        // Sort by similarity (descending) - best matches first
        tracksWithSimilarity.sort((a, b) => b.similarity - a.similarity)

        // DEBUG: Log search results with similarity scores
        console.log('[SPOTIFY RESULTS]', {
          totalTracks: tracksWithSimilarity.length,
          top5: tracksWithSimilarity.slice(0, 5).map(t => ({
            name: t.track.name,
            artist: t.track.artists[0]?.name,
            album: t.track.album.name,
            similarity: t.similarity
          }))
        })

        // Update debug UI
        setDebugInfo({
          query: `track:${song.title}`,
          trackCount: tracksWithSimilarity.length,
          topResults: tracksWithSimilarity.slice(0, 3).map(t => ({
            name: t.track.name,
            artist: t.track.artists[0]?.name || '',
            album: t.track.album.name
          }))
        })

        // Use best match (highest similarity)
        const bestMatch = tracksWithSimilarity[0].track
        const similarity = tracksWithSimilarity[0].similarity

        // DEBUG: Log best match
        console.log('[BEST MATCH]', {
          local: { artist: song.artist, title: song.title, album: song.album },
          spotify: {
            artist: bestMatch.artists[0]?.name,
            title: bestMatch.name,
            album: bestMatch.album.name
          },
          similarity
        })

        // Try auto-match (will only succeed if enabled and similarity >= 80%)
        const wasAutoMatched = await attemptAutoMatchAndUpdateState(song.id, bestMatch, similarity )

        // If not auto-matched, update state with manual match option
        if (!wasAutoMatched) {
          dispatchSongs({
            type: 'UPDATE_MATCH',
            payload: { songId: song.id, spotifyMatch: bestMatch, similarity }
          })
        }
      } else {
        console.log('[NO MATCH]', { songId: song.id, artist: song.artist, title: song.title })
        dispatchSongs({ type: 'SET_SEARCHING', payload: { songId: song.id, searching: false } })
      }
    } catch (err) {
      console.error('Error searching for match:', err)
      dispatchSongs({ type: 'SET_SEARCHING', payload: { songId: song.id, searching: false } })
    }
  }

  async function handleMatch(songId: number, spotifyId: string) {
    try {
      setMatchingIds((prev) => new Set(prev).add(songId))

      const result = await saveSongMatch(songId, spotifyId)

      if (!result.success) {
        alert(`Error: ${result.error}`)
        setMatchingIds((prev) => {
          const next = new Set(prev)
          next.delete(songId)
          return next
        })
        return
      }

      // Update local state to mark as matched
      dispatchSongs({ type: 'MARK_MATCHED', payload: { songId, spotifyId } })

      setMatchingIds((prev) => {
        const next = new Set(prev)
        next.delete(songId)
        return next
      })
    } catch (err) {
      console.error('Error saving match:', err)
      alert('Failed to save match')
      setMatchingIds((prev) => {
        const next = new Set(prev)
        next.delete(songId)
        return next
      })
    }
  }

  async function handleReviewMatch(songId: number, spotifyId: string) {
    await handleMatch(songId, spotifyId)
    // Move to next song in review
    setCurrentReviewIndex((prev) => prev + 1)
  }

  function handleSkip() {
    // Just move to next song without saving
    setCurrentReviewIndex((prev) => prev + 1)
  }

  async function handleUndo(songId: number) {
    try {
      setMatchingIds((prev) => new Set(prev).add(songId))

      const result = await clearSongMatch(songId)

      if (!result.success) {
        alert(`Error: ${result.error}`)
        setMatchingIds((prev) => {
          const next = new Set(prev)
          next.delete(songId)
          return next
        })
        return
      }

      // Update local state to mark as unmatched
      dispatchSongs({ type: 'CLEAR_MATCH', payload: { songId } })

      setMatchingIds((prev) => {
        const next = new Set(prev)
        next.delete(songId)
        return next
      })
    } catch (err) {
      console.error('Error undoing match:', err)
      alert('Failed to undo match')
      setMatchingIds((prev) => {
        const next = new Set(prev)
        next.delete(songId)
        return next
      })
    }
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
          <p className="text-muted-foreground">
            No unmatched songs found.
          </p>
        </div>
      </div>
    )
  }

  const matchedCount = songsWithMatches.filter((s) => s.isMatched).length
  const totalCount = songsWithMatches.length
  const currentReview = songsWithMatches[currentReviewIndex]
  const hasMoreToReview = currentReviewIndex < songsWithMatches.length

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-bold">Spotify Matcher</h1>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoMatchEnabled}
            onChange={(e) => setAutoMatchEnabled(e.target.checked)}
            aria-label="Auto-match songs with similarity >= 80%"
            className="w-4 h-4"
          />
          <span className="text-sm">Auto-match (≥80%)</span>
        </label>
      </div>
      <p className="text-muted-foreground mb-8">
        Match your iTunes songs with Spotify tracks
      </p>

      {/* DEBUG PANEL */}
      {debugInfo && (
        <div data-testid="debug-panel" className="mb-8 p-4 border-2 border-yellow-300 rounded-lg bg-yellow-50">
          <h3 className="font-bold text-yellow-900 mb-2">🐛 DEBUG: Spotify Search</h3>
          <div className="text-sm space-y-2">
            <div>
              <span className="font-semibold">Query:</span> <code className="bg-yellow-100 px-1">{debugInfo.query}</code>
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
                ⚠️ NO RESULTS - Search may be too restrictive!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tinder-style Review Card */}
      {hasMoreToReview && currentReview && (
        <ReviewCard
          currentReview={currentReview}
          currentIndex={currentReviewIndex}
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
          <p className="text-sm text-green-700">All songs have been reviewed. You can still use the table below to make changes.</p>
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
          />
        ))}
      </div>
    </div>
  )
}
