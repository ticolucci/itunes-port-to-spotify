/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAutoMatch } from './useAutoMatch'
import { createMockSongWithMatch, createMockSpotifyTrack } from '@/lib/test-helpers/fixtures'

// Mock the spotify-actions module
vi.mock('@/lib/spotify-actions', () => ({
  saveSongMatch: vi.fn(),
}))

import { saveSongMatch } from '@/lib/spotify-actions'

describe('useAutoMatch', () => {
  const mockDispatch = vi.fn()
  const matchingIds = new Set<number>()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(saveSongMatch as any).mockResolvedValue({ success: true })
  })

  describe('initial state', () => {
    it('should return autoMatchEnabled as false initially', () => {
      const { result } = renderHook(() =>
        useAutoMatch({
          songsWithMatches: [],
          matchingIds,
          dispatchSongs: mockDispatch,
        })
      )

      expect(result.current.autoMatchEnabled).toBe(false)
    })

    it('should provide setAutoMatchEnabled function', () => {
      const { result } = renderHook(() =>
        useAutoMatch({
          songsWithMatches: [],
          matchingIds,
          dispatchSongs: mockDispatch,
        })
      )

      expect(typeof result.current.setAutoMatchEnabled).toBe('function')
    })
  })

  describe('toggle functionality', () => {
    it('should toggle autoMatchEnabled state', () => {
      const { result } = renderHook(() =>
        useAutoMatch({
          songsWithMatches: [],
          matchingIds,
          dispatchSongs: mockDispatch,
        })
      )

      act(() => {
        result.current.setAutoMatchEnabled(true)
      })

      expect(result.current.autoMatchEnabled).toBe(true)
    })
  })

  describe('auto-matching behavior', () => {
    it('should not auto-match when disabled', async () => {
      const eligibleSong = createMockSongWithMatch({
        dbSong: { id: 1, title: 'Test', artist: 'Artist', album: 'Album', album_artist: null, filename: null, spotify_id: null },
        spotifyMatch: createMockSpotifyTrack({ id: 'spotify1' }),
        similarity: 90,
        isMatched: false,
      })

      const { result } = renderHook(() =>
        useAutoMatch({
          songsWithMatches: [eligibleSong],
          matchingIds: new Set(),
          dispatchSongs: mockDispatch,
        })
      )

      // Auto-match is disabled by default
      expect(result.current.autoMatchEnabled).toBe(false)

      // Wait a tick to ensure no async operations are triggered
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      expect(saveSongMatch).not.toHaveBeenCalled()
    })

    it('should auto-match eligible songs when enabled', async () => {
      const eligibleSong = createMockSongWithMatch({
        dbSong: { id: 1, title: 'Test', artist: 'Artist', album: 'Album', album_artist: null, filename: null, spotify_id: null },
        spotifyMatch: createMockSpotifyTrack({ id: 'spotify1' }),
        similarity: 90,
        isMatched: false,
      })

      const { result } = renderHook(() =>
        useAutoMatch({
          songsWithMatches: [eligibleSong],
          matchingIds: new Set(),
          dispatchSongs: mockDispatch,
        })
      )

      // Enable auto-match
      act(() => {
        result.current.setAutoMatchEnabled(true)
      })

      await waitFor(() => {
        expect(saveSongMatch).toHaveBeenCalledWith(1, 'spotify1')
      })
    })

    it('should not auto-match songs with similarity below 80%', async () => {
      const lowSimilaritySong = createMockSongWithMatch({
        dbSong: { id: 1, title: 'Test', artist: 'Artist', album: 'Album', album_artist: null, filename: null, spotify_id: null },
        spotifyMatch: createMockSpotifyTrack({ id: 'spotify1' }),
        similarity: 70, // Below threshold
        isMatched: false,
      })

      const { result } = renderHook(() =>
        useAutoMatch({
          songsWithMatches: [lowSimilaritySong],
          matchingIds: new Set(),
          dispatchSongs: mockDispatch,
        })
      )

      act(() => {
        result.current.setAutoMatchEnabled(true)
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      expect(saveSongMatch).not.toHaveBeenCalled()
    })

    it('should not auto-match already matched songs', async () => {
      const alreadyMatchedSong = createMockSongWithMatch({
        dbSong: { id: 1, title: 'Test', artist: 'Artist', album: 'Album', album_artist: null, filename: null, spotify_id: 'existing' },
        spotifyMatch: createMockSpotifyTrack({ id: 'spotify1' }),
        similarity: 90,
        isMatched: true,
      })

      const { result } = renderHook(() =>
        useAutoMatch({
          songsWithMatches: [alreadyMatchedSong],
          matchingIds: new Set(),
          dispatchSongs: mockDispatch,
        })
      )

      act(() => {
        result.current.setAutoMatchEnabled(true)
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      expect(saveSongMatch).not.toHaveBeenCalled()
    })

    it('should dispatch BATCH_MATCH action for successful matches', async () => {
      const eligibleSong = createMockSongWithMatch({
        dbSong: { id: 1, title: 'Test', artist: 'Artist', album: 'Album', album_artist: null, filename: null, spotify_id: null },
        spotifyMatch: createMockSpotifyTrack({ id: 'spotify1' }),
        similarity: 90,
        isMatched: false,
      })

      const { result } = renderHook(() =>
        useAutoMatch({
          songsWithMatches: [eligibleSong],
          matchingIds: new Set(),
          dispatchSongs: mockDispatch,
        })
      )

      act(() => {
        result.current.setAutoMatchEnabled(true)
      })

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith({
          type: 'BATCH_MATCH',
          payload: expect.any(Map),
        })
      })
    })
  })

  describe('attemptAutoMatchAndUpdateState', () => {
    it('should return the function for external use', () => {
      const { result } = renderHook(() =>
        useAutoMatch({
          songsWithMatches: [],
          matchingIds,
          dispatchSongs: mockDispatch,
        })
      )

      expect(typeof result.current.attemptAutoMatchAndUpdateState).toBe('function')
    })

    it('should save match and dispatch AUTO_MATCH action when similarity >= 80%', async () => {
      const { result } = renderHook(() =>
        useAutoMatch({
          songsWithMatches: [],
          matchingIds,
          dispatchSongs: mockDispatch,
        })
      )

      act(() => {
        result.current.setAutoMatchEnabled(true)
      })

      const spotifyMatch = createMockSpotifyTrack({ id: 'spotify1' })
      let wasMatched: boolean = false

      await act(async () => {
        wasMatched = await result.current.attemptAutoMatchAndUpdateState(
          1,
          spotifyMatch,
          90,
          [{ track: spotifyMatch, similarity: 90 }]
        )
      })

      expect(wasMatched).toBe(true)
      expect(saveSongMatch).toHaveBeenCalledWith(1, 'spotify1')
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'AUTO_MATCH',
        payload: expect.objectContaining({
          songId: 1,
          spotifyMatch,
          similarity: 90,
          spotifyId: 'spotify1',
        }),
      })
    })

    it('should return false when auto-match is disabled', async () => {
      const { result } = renderHook(() =>
        useAutoMatch({
          songsWithMatches: [],
          matchingIds,
          dispatchSongs: mockDispatch,
        })
      )

      const spotifyMatch = createMockSpotifyTrack({ id: 'spotify1' })
      let wasMatched: boolean = true

      await act(async () => {
        wasMatched = await result.current.attemptAutoMatchAndUpdateState(
          1,
          spotifyMatch,
          90,
          [{ track: spotifyMatch, similarity: 90 }]
        )
      })

      expect(wasMatched).toBe(false)
      expect(saveSongMatch).not.toHaveBeenCalled()
    })

    it('should return false when similarity is below 80%', async () => {
      const { result } = renderHook(() =>
        useAutoMatch({
          songsWithMatches: [],
          matchingIds,
          dispatchSongs: mockDispatch,
        })
      )

      act(() => {
        result.current.setAutoMatchEnabled(true)
      })

      const spotifyMatch = createMockSpotifyTrack({ id: 'spotify1' })
      let wasMatched: boolean = true

      await act(async () => {
        wasMatched = await result.current.attemptAutoMatchAndUpdateState(
          1,
          spotifyMatch,
          70, // Below threshold
          [{ track: spotifyMatch, similarity: 70 }]
        )
      })

      expect(wasMatched).toBe(false)
      expect(saveSongMatch).not.toHaveBeenCalled()
    })
  })
})
