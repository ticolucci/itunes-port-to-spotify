'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Check, ChevronRight, Music, Undo2 } from 'lucide-react'
import type { Song } from '@/lib/schema'
import type { SpotifyTrack } from '@/lib/spotify'
import {
  getNextUnmatchedAlbum,
  getSongsByAlbum,
  searchSpotifyForSong,
  saveSongMatch,
  clearSongMatch,
} from '@/lib/spotify-actions'
import { ReviewCard } from './ReviewCard'

interface SongWithMatch {
  dbSong: Song
  spotifyMatch: SpotifyTrack | null
  similarity: number
  isMatched: boolean
  searching: boolean
}

export default function SpotifyMatcherPage() {
  const [currentAlbum, setCurrentAlbum] = useState<{
    artist: string | null
    album: string | null
  } | null>(null)
  const [songsWithMatches, setSongsWithMatches] = useState<SongWithMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [matchingIds, setMatchingIds] = useState<Set<number>>(new Set())
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0)

  const loadNextAlbum = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // 1. Get next unmatched album
      const albumResult = await getNextUnmatchedAlbum()

      if (!albumResult.success) {
        setError(albumResult.error)
        setLoading(false)
        return
      }

      setCurrentAlbum({
        artist: albumResult.artist,
        album: albumResult.album,
      })

      // 2. Get all songs for this album
      const songsResult = await getSongsByAlbum(
        albumResult.artist,
        albumResult.album
      )

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

      setSongsWithMatches(initialSongs)
      setLoading(false)
      setCurrentReviewIndex(0) // Reset review index

      // 4. Search for Spotify matches for each unmatched song
      for (let i = 0; i < songsResult.songs.length; i++) {
        const song = songsResult.songs[i]
        // Skip songs without spotify_id and with sufficient metadata
        if (!song.spotify_id && song.title && song.artist && song.album) {
          searchForMatch(i, song)
        }
      }
    } catch (err) {
      console.error('Error loading album:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadNextAlbum()
  }, [loadNextAlbum])

  async function searchForMatch(index: number, song: Song) {
    // Update searching state
    setSongsWithMatches((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, searching: true } : item
      )
    )

    try {
      const result = await searchSpotifyForSong(
        song.artist,
        song.album,
        song.title
      )

      if (result.success && result.tracks.length > 0) {
        // Find best match
        const bestMatch = result.tracks[0]
        const similarity = calculateSimilarity(song.title, bestMatch.name)

        setSongsWithMatches((prev) =>
          prev.map((item, i) =>
            i === index
              ? {
                  ...item,
                  spotifyMatch: bestMatch,
                  similarity,
                  searching: false,
                }
              : item
          )
        )
      } else {
        setSongsWithMatches((prev) =>
          prev.map((item, i) =>
            i === index ? { ...item, searching: false } : item
          )
        )
      }
    } catch (err) {
      console.error('Error searching for match:', err)
      setSongsWithMatches((prev) =>
        prev.map((item, i) =>
          i === index ? { ...item, searching: false } : item
        )
      )
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
      setSongsWithMatches((prev) =>
        prev.map((item) =>
          item.dbSong.id === songId
            ? { ...item, isMatched: true, dbSong: { ...item.dbSong, spotify_id: spotifyId } }
            : item
        )
      )

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
      setSongsWithMatches((prev) =>
        prev.map((item) =>
          item.dbSong.id === songId
            ? { ...item, isMatched: false, dbSong: { ...item.dbSong, spotify_id: null } }
            : item
        )
      )

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
          <p className="text-muted-foreground">Loading album...</p>
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

  if (!currentAlbum) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">All Albums Matched!</h1>
          <p className="text-muted-foreground">
            No more albums to match with Spotify.
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
      <h1 className="text-3xl font-bold mb-2">Spotify Matcher</h1>
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

      {/* Album Header */}
      <div className="mb-8 p-6 border rounded-lg bg-muted/50">
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">
          Current Album
        </h2>
        <h3 className="text-2xl font-bold">{currentAlbum.album || <span className="italic text-muted-foreground">(No Album)</span>}</h3>
        <p className="text-lg text-muted-foreground mb-4">
          {currentAlbum.artist || <span className="italic">(No Artist)</span>}
        </p>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {matchedCount} / {totalCount} songs matched
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadNextAlbum()}
          >
            Next Album
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
              <div className="flex items-start gap-3">
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
                  <p className="text-sm text-amber-600 italic">
                    Incomplete metadata - skipped
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No match found
                  </p>
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
