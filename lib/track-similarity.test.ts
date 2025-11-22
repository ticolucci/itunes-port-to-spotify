import { describe, it, expect } from 'vitest'
import {
  calculateTracksWithSimilarity,
  getBestTrackSimilarity,
  sortTracksBySimilarity,
  type TrackWithSimilarity,
} from './track-similarity'
import type { SpotifyTrack } from './spotify'

// Helper to create mock SpotifyTrack
function createMockTrack(overrides: Partial<{
  id: string
  name: string
  artistName: string
  albumName: string
}>): SpotifyTrack {
  return {
    id: overrides.id || 'track-1',
    name: overrides.name || 'Test Track',
    artists: [{ name: overrides.artistName || 'Test Artist' }],
    album: {
      name: overrides.albumName || 'Test Album',
      images: [{ url: 'https://example.com/image.jpg', height: 300, width: 300 }],
    },
    uri: 'spotify:track:test',
  }
}

describe('track-similarity', () => {
  describe('calculateTracksWithSimilarity', () => {
    it('returns empty array for empty tracks input', () => {
      const result = calculateTracksWithSimilarity(
        [],
        { artist: 'Artist', title: 'Title', album: 'Album' }
      )
      expect(result).toEqual([])
    })

    it('calculates similarity for each track', () => {
      const tracks = [
        createMockTrack({ id: '1', name: 'Song A', artistName: 'Artist A' }),
        createMockTrack({ id: '2', name: 'Song B', artistName: 'Artist B' }),
      ]

      const result = calculateTracksWithSimilarity(
        tracks,
        { artist: 'Artist A', title: 'Song A', album: 'Test Album' }
      )

      expect(result).toHaveLength(2)
      expect(result[0].track.id).toBe('1')
      expect(result[0].similarity).toBeGreaterThan(result[1].similarity)
    })

    it('handles tracks with missing artist', () => {
      const tracks = [
        {
          ...createMockTrack({ id: '1', name: 'Song' }),
          artists: [], // No artists
        } as SpotifyTrack,
      ]

      const result = calculateTracksWithSimilarity(
        tracks,
        { artist: 'Artist', title: 'Song', album: 'Album' }
      )

      expect(result).toHaveLength(1)
      expect(typeof result[0].similarity).toBe('number')
    })

    it('handles local song with null fields', () => {
      const tracks = [createMockTrack({ id: '1' })]

      const result = calculateTracksWithSimilarity(
        tracks,
        { artist: null, title: 'Test Track', album: null }
      )

      expect(result).toHaveLength(1)
      expect(typeof result[0].similarity).toBe('number')
    })
  })

  describe('getBestTrackSimilarity', () => {
    it('returns 0 for empty tracks array', () => {
      const result = getBestTrackSimilarity(
        [],
        { artist: 'Artist', title: 'Title', album: 'Album' }
      )
      expect(result).toBe(0)
    })

    it('returns highest similarity score from tracks', () => {
      const tracks = [
        createMockTrack({ id: '1', name: 'Different Song', artistName: 'Different Artist' }),
        createMockTrack({ id: '2', name: 'My Song', artistName: 'My Artist' }),
        createMockTrack({ id: '3', name: 'Another Song', artistName: 'Another Artist' }),
      ]

      const result = getBestTrackSimilarity(
        tracks,
        { artist: 'My Artist', title: 'My Song', album: 'My Album' }
      )

      // The track with "My Song" by "My Artist" should have the highest similarity
      expect(result).toBeGreaterThan(50)
    })

    it('returns 100 for exact match', () => {
      const tracks = [
        createMockTrack({ id: '1', name: 'Exact Title', artistName: 'Exact Artist', albumName: 'Exact Album' }),
      ]

      const result = getBestTrackSimilarity(
        tracks,
        { artist: 'Exact Artist', title: 'Exact Title', album: 'Exact Album' }
      )

      expect(result).toBe(100)
    })
  })

  describe('sortTracksBySimilarity', () => {
    it('returns empty array for empty input', () => {
      const result = sortTracksBySimilarity([])
      expect(result).toEqual([])
    })

    it('sorts tracks by similarity in descending order', () => {
      const tracksWithSimilarity: TrackWithSimilarity[] = [
        { track: createMockTrack({ id: '1' }), similarity: 50 },
        { track: createMockTrack({ id: '2' }), similarity: 90 },
        { track: createMockTrack({ id: '3' }), similarity: 70 },
      ]

      const result = sortTracksBySimilarity(tracksWithSimilarity)

      expect(result[0].similarity).toBe(90)
      expect(result[1].similarity).toBe(70)
      expect(result[2].similarity).toBe(50)
    })

    it('does not mutate the original array', () => {
      const tracksWithSimilarity: TrackWithSimilarity[] = [
        { track: createMockTrack({ id: '1' }), similarity: 50 },
        { track: createMockTrack({ id: '2' }), similarity: 90 },
      ]

      const originalFirst = tracksWithSimilarity[0]
      sortTracksBySimilarity(tracksWithSimilarity)

      expect(tracksWithSimilarity[0]).toBe(originalFirst)
    })

    it('handles tracks with equal similarity', () => {
      const tracksWithSimilarity: TrackWithSimilarity[] = [
        { track: createMockTrack({ id: '1' }), similarity: 80 },
        { track: createMockTrack({ id: '2' }), similarity: 80 },
      ]

      const result = sortTracksBySimilarity(tracksWithSimilarity)

      expect(result).toHaveLength(2)
      expect(result[0].similarity).toBe(80)
      expect(result[1].similarity).toBe(80)
    })
  })
})
