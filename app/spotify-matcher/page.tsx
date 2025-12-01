'use client'

import { useEffect, useCallback, useReducer, useState, useRef } from 'react'
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
import { DebugPanel } from './components/DebugPanel'
import { calculateTracksWithSimilarity, sortTracksBySimilarity } from '@/lib/track-similarity'
import {
  shouldSkipSong,
  createInitialSongs,
  findNextReviewableIndex,
} from '@/lib/song-matcher-utils'
import { matcherReducer, initialMatcherState } from './state/matcherReducer'
import { batchSearchSongs } from '@/lib/batch-search'

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (IFrameAPI: any) => void
  }
}

export default function SpotifyMatcherPage() {
  const [state, dispatch] = useReducer(matcherReducer, initialMatcherState)
  const [spotifyEmbedController, setSpotifyEmbedController] = useState<any | null>(null);

  const {
    currentArtist,
    songs: songsWithMatches,
    loading,
    error,
    matchingIds,
    currentReviewIndex,
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

      // 4. Search for Spotify matches with rate limiting
      // Uses bottleneck to limit concurrent requests and prevent Spotify API rate limiting
      batchSearchSongs(songsResult.songs, searchForMatch, {
        onError: (song, err) => {
          console.error(`Failed to search for song ${song.id}:`, err)
        },
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

  const spotifyEmbededIframe = useRef<HTMLDivElement>(null);

  const configureSpotifyEmbed = useCallback((IFrameAPI: any) => {
      if (!spotifyEmbededIframe.current) {
        setTimeout(() => {
          configureSpotifyEmbed(IFrameAPI);
        }, 100);
        return ;
      }

      const element = spotifyEmbededIframe.current;
      const options = {};
      IFrameAPI.createController(element, options, (EmbedController: any) => setSpotifyEmbedController(EmbedController));
    }, [spotifyEmbededIframe])

  useEffect(() => {
    window.onSpotifyIframeApiReady = configureSpotifyEmbed
  }, []);

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
        const tracksWithSimilarity = sortTracksBySimilarity(
          calculateTracksWithSimilarity(result.tracks, {
            artist: song.artist,
            title: song.title,
            album: song.album,
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

        // Update state with match for manual review
        dispatch({
          type: 'UPDATE_SONG_MATCH',
          payload: { songId: song.id, spotifyMatch: bestMatch, similarity, allMatches },
        })
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

  function handlePlaySong(spotifyId: string) {
    if (spotifyEmbedController) {
      spotifyEmbedController.loadUri(`spotify:track:${spotifyId}`);
      spotifyEmbedController.play();
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
      </div>
      <p className="text-muted-foreground mb-8">Match your iTunes songs with Spotify tracks</p>

      {/* DEBUG PANEL */}
      {/* <DebugPanel debugInfo={debugInfo} /> */}
      <div ref={spotifyEmbededIframe}></div>

      {/* Tinder-style Review Card */}
      {hasMoreToReview && currentReview && (
        <ReviewCard
          currentReview={currentReview}
          currentIndex={reviewableIndex}
          totalCount={songsWithMatches.length}
          isMatching={matchingIds.has(currentReview.dbSong.id)}
          onMatch={handleReviewMatch}
          onSkip={handleSkip}
          handlePlaySong={handlePlaySong}
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
            handlePlaySong={handlePlaySong}
          />
        ))}
      </div>
    </div>
  )
}
