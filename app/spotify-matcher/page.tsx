'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Check, ChevronRight } from 'lucide-react'
import type { Song } from '@/lib/types'
import type { SpotifyTrack } from '@/lib/spotify'
import {
  getNextUnmatchedSong,
  getSongsByArtist,
  searchSpotifyByArtistAlbum,
  saveSongMatch,
} from '@/lib/spotify-actions'

export default function SpotifyMatcherPage() {
  const [currentSong, setCurrentSong] = useState<Song | null>(null)
  const [artistSongs, setArtistSongs] = useState<Song[]>([])
  const [spotifyTracks, setSpotifyTracks] = useState<SpotifyTrack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [matching, setMatching] = useState(false)

  useEffect(() => {
    loadNextSong()
  }, [])

  async function loadNextSong() {
    try {
      setLoading(true)
      setError(null)

      // 1. Fetch first song without spotify_id
      const songResult = await getNextUnmatchedSong()

      if (!songResult.success) {
        setError(songResult.error)
        setLoading(false)
        return
      }

      setCurrentSong(songResult.song)

      // 2. Find all songs for the same artist, sorted by album
      const artistResult = await getSongsByArtist(songResult.song.artist)

      if (artistResult.success) {
        setArtistSongs(artistResult.songs)
      }

      // 3. Search Spotify for artist & album
      const spotifyResult = await searchSpotifyByArtistAlbum(
        songResult.song.artist,
        songResult.song.album
      )

      if (spotifyResult.success) {
        setSpotifyTracks(spotifyResult.tracks)
      }

      setLoading(false)
    } catch (err) {
      console.error('Error loading song:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
  }

  async function handleMatch(songId: number, spotifyId: string) {
    try {
      setMatching(true)

      const result = await saveSongMatch(songId, spotifyId)

      if (!result.success) {
        alert(`Error: ${result.error}`)
        return
      }

      // Load next song
      await loadNextSong()
    } catch (err) {
      console.error('Error saving match:', err)
      alert('Failed to save match')
    } finally {
      setMatching(false)
    }
  }

  function calculateSimilarity(localTitle: string, spotifyTitle: string): number {
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
          <p className="text-muted-foreground">Loading songs...</p>
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

  if (!currentSong) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">All Songs Matched!</h1>
          <p className="text-muted-foreground">
            No more songs to match with Spotify.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-2">Spotify Matcher</h1>
      <p className="text-muted-foreground mb-8">
        Match your iTunes songs with Spotify tracks
      </p>

      {/* Current Song */}
      <div className="mb-8 p-6 border rounded-lg bg-muted/50">
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">
          Current Song
        </h2>
        <h3 className="text-2xl font-bold">{currentSong.title}</h3>
        <p className="text-lg text-muted-foreground">
          {currentSong.artist} • {currentSong.album}
        </p>
      </div>

      {/* Artist Songs */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">
          Songs by {currentSong.artist} ({artistSongs.length})
        </h2>
        <div className="grid gap-2">
          {artistSongs.slice(0, 5).map((song) => (
            <div
              key={song.id}
              className="p-3 border rounded-lg text-sm flex justify-between items-center"
            >
              <div>
                <p className="font-medium">{song.title}</p>
                <p className="text-muted-foreground">{song.album}</p>
              </div>
              {song.spotify_id && (
                <Check className="h-4 w-4 text-green-600" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Spotify Matches */}
      <div>
        <h2 className="text-xl font-semibold mb-4">
          Spotify Matches ({spotifyTracks.length})
        </h2>
        <div className="grid gap-4">
          {spotifyTracks.map((track) => {
            const similarity = calculateSimilarity(
              currentSong.title,
              track.name
            )

            return (
              <div
                key={track.id}
                className="p-4 border rounded-lg flex justify-between items-center hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold">{track.name}</p>
                    {similarity >= 80 && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                        {similarity}% match
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {track.artists.map((a) => a.name).join(', ')} •{' '}
                    {track.album.name}
                  </p>
                </div>
                <Button
                  onClick={() => handleMatch(currentSong.id, track.id)}
                  disabled={matching}
                  size="sm"
                >
                  {matching ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  It's a Match
                </Button>
              </div>
            )
          })}
        </div>

        {spotifyTracks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No Spotify tracks found for this artist and album.
            <br />
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => handleMatch(currentSong.id, '')}
              disabled={matching}
            >
              Skip this song
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
