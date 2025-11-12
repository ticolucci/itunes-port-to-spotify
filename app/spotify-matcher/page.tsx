'use client'

import { useState, useEffect, useCallback, useRef, useReducer } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Check, ChevronRight, Music, Undo2 } from 'lucide-react'
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
import { AISuggestion } from './AISuggestion'

interface SongWithMatch {
  dbSong: Song
  spotifyMatch: SpotifyTrack | null
  similarity: number
  isMatched: boolean
  searching: boolean
}

type SongsAction =
  | { type: 'SET_SONGS'; payload: SongWithMatch[] }
  | { type: 'SET_SEARCHING'; payload: { songId: number; searching: boolean } }
  | { type: 'UPDATE_MATCH'; payload: { songId: number; spotifyMatch: SpotifyTrack; similarity: number } }
  | { type: 'AUTO_MATCH'; payload: { songId: number; spotifyMatch: SpotifyTrack; similarity: number; spotifyId: string } }
  | { type: 'MARK_MATCHED'; payload: { songId: number; spotifyId: string } }
  | { type: 'BATCH_MATCH'; payload: Map<number, { spotifyMatch: SpotifyTrack; similarity: number }> }
  | { type: 'CLEAR_MATCH'; payload: { songId: number } }

function songsReducer(state: SongWithMatch[], action: SongsAction): SongWithMatch[] {
  switch (action.type) {
    case 'SET_SONGS':
      return action.payload

    case 'SET_SEARCHING':
      return state.map((item) =>
        item.dbSong.id === action.payload.songId
          ? { ...item, searching: action.payload.searching }
          : item
      )

    case 'UPDATE_MATCH':
      return state.map((item) =>
        item.dbSong.id === action.payload.songId
          ? {
              ...item,
              spotifyMatch: action.payload.spotifyMatch,
              similarity: action.payload.similarity,
              searching: false,
            }
          : item
      )

    case 'AUTO_MATCH':
      return state.map((item) =>
        item.dbSong.id === action.payload.songId
          ? {
              ...item,
              spotifyMatch: action.payload.spotifyMatch,
              similarity: action.payload.similarity,
              searching: false,
              isMatched: true,
              dbSong: { ...item.dbSong, spotify_id: action.payload.spotifyId },
            }
          : item
      )

    case 'MARK_MATCHED':
      return state.map((item) =>
        item.dbSong.id === action.payload.songId
          ? {
              ...item,
              isMatched: true,
              dbSong: { ...item.dbSong, spotify_id: action.payload.spotifyId },
            }
          : item
      )

    case 'BATCH_MATCH':
      return state.map((item) => {
        const matchData = action.payload.get(item.dbSong.id)
        return matchData
          ? {
              ...item,
              spotifyMatch: matchData.spotifyMatch,
              similarity: matchData.similarity,
              searching: false,
              isMatched: true,
              dbSong: { ...item.dbSong, spotify_id: matchData.spotifyMatch.id },
            }
          : item
      })

    case 'CLEAR_MATCH':
      return state.map((item) =>
        item.dbSong.id === action.payload.songId
          ? {
              ...item,
              isMatched: false,
              dbSong: { ...item.dbSong, spotify_id: null },
            }
          : item
      )

    default:
      return state
  }
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

  const loadRandomArtist = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      processedAutoMatches.current.clear() // Reset tracking when loading new artist

      // 1. Get a random unmatched song
      const randomSongResult = await getRandomUnmatchedSong()

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
      const initialSongs: SongWithMatch[] = songsResult.songs.map((song) => ({
        dbSong: song,
        spotifyMatch: null,
        similarity: 0,
        isMatched: !!song.spotify_id,
        searching: false,
      }))

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const eligibleSongs = songsWithMatches.filter(
          (s) =>
            s.spotifyMatch &&
            s.similarity >= 80 &&
            !s.isMatched &&
            !matchingIds.has(s.dbSong.id) &&
            !processedAutoMatches.current.has(s.dbSong.id)
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
    if (!song.title || song.title.trim() === '') {
      return
    }

    // Update searching state
    dispatchSongs({ type: 'SET_SEARCHING', payload: { songId: song.id, searching: true } })

    try {
      const result = await searchSpotifyForSong(song.artist, song.album, song.title)

      if (result.success && result.tracks.length > 0) {
        // Find best match
        const bestMatch = result.tracks[0]
        const similarity = calculateSimilarity(song.title, bestMatch.name)

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

  function calculateSimilarity(localTitle: string | null, spotifyTitle: string): number {
    // Handle null/undefined values
    if (!localTitle || !spotifyTitle) return 0

    const normalize = (str: string) =>
      str.toLowerCase().replace(/[^a-z0-9]/g, '')
    const local = normalize(localTitle)
    const spotify = normalize(spotifyTitle)

    if (local === spotify) return 100

    // Simple substring matching
    if (local.includes(spotify) || spotify.includes(local)) return 80

    // Check word overlap
    const localWords = local.split(/\s+/)
    const spotifyWords = spotify.split(/\s+/)
    const commonWords = localWords.filter((word) => spotifyWords.includes(word))
    const similarity = (commonWords.length / Math.max(localWords.length, spotifyWords.length)) * 100

    return Math.round(similarity)
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
      <div className="mb-8 p-6 border rounded-lg bg-muted/50">
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">
          Current Artist
        </h2>
        <h3 className="text-2xl font-bold">{currentArtist || <span className="italic text-muted-foreground">(No Artist)</span>}</h3>
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            {matchedCount} / {totalCount} songs matched
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadRandomArtist()}
          >
            Random Artist
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Songs Table */}
      <div className="space-y-3">
        {songsWithMatches.map((songWithMatch) => {
          const isMatching = matchingIds.has(songWithMatch.dbSong.id)
          const albumImage =
            songWithMatch.spotifyMatch?.album.images?.[0]?.url

          return (
            <div
              key={songWithMatch.dbSong.id}
              className={`border rounded-lg p-4 grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr_auto] gap-4 items-center ${
                songWithMatch.isMatched ? 'bg-green-50/50 border-green-200' : ''
              }`}
            >
              {/* DB Song */}
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-muted rounded flex items-center justify-center flex-shrink-0">
                  <Music className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {songWithMatch.dbSong.title || <span className="italic text-muted-foreground">(No Title)</span>}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {songWithMatch.dbSong.artist || <span className="italic">(No Artist)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {songWithMatch.dbSong.album || <span className="italic">(No Album)</span>}
                  </p>
                </div>
              </div>

              {/* Arrow */}
              <div className="hidden lg:flex justify-center">
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>

              {/* Spotify Match */}
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {songWithMatch.searching ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Searching...</span>
                  </div>
                ) : songWithMatch.spotifyMatch ? (
                  <>
                    {albumImage && (
                      // eslint-disable-next-line @next/next/no-img-element -- Spotify CDN images are already optimized
                      <img
                        src={albumImage}
                        alt={songWithMatch.spotifyMatch.album.name}
                        className="w-12 h-12 rounded flex-shrink-0 object-cover"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate">
                          {songWithMatch.spotifyMatch.name}
                        </p>
                        {songWithMatch.similarity >= 80 && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded flex-shrink-0">
                            {songWithMatch.similarity}%
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {songWithMatch.spotifyMatch.artists
                          .map((a) => a.name)
                          .join(', ')}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {songWithMatch.spotifyMatch.album.name}
                      </p>
                    </div>
                  </>
                ) : !songWithMatch.dbSong.title || !songWithMatch.dbSong.artist || !songWithMatch.dbSong.album ? (
                  <div className="w-full">
                    <p className="text-sm text-amber-600 italic mb-3">
                      Incomplete metadata - skipped
                    </p>
                    <AISuggestion
                      song={songWithMatch.dbSong}
                    />
                  </div>
                ) : (
                  <div className="w-full">
                    <p className="text-sm text-muted-foreground mb-3">
                      No match found
                    </p>
                    <AISuggestion
                      song={songWithMatch.dbSong}
                    />
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="flex justify-end">
                {songWithMatch.isMatched ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUndo(songWithMatch.dbSong.id)}
                    disabled={isMatching}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {isMatching ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Undo2 className="h-4 w-4 mr-2" />
                    )}
                    Undo
                  </Button>
                ) : songWithMatch.spotifyMatch ? (
                  <Button
                    onClick={() =>
                      handleMatch(
                        songWithMatch.dbSong.id,
                        songWithMatch.spotifyMatch!.id
                      )
                    }
                    disabled={isMatching}
                    size="sm"
                  >
                    {isMatching ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Match
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMatch(songWithMatch.dbSong.id, '')}
                    disabled={isMatching}
                  >
                    Skip
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
