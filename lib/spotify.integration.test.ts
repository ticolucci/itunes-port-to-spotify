/**
 * Integration tests for Spotify API using Polly.js for HTTP recording/replay.
 *
 * These tests use real API responses (recorded) instead of mocks, providing
 * more realistic test coverage while remaining fast and deterministic.
 *
 * Run modes:
 * - POLLY_MODE=record npm test -- lib/spotify.integration.test.ts (records real API calls)
 * - POLLY_MODE=replay npm test -- lib/spotify.integration.test.ts (uses recordings, default)
 * - npm test -- lib/spotify.integration.test.ts (same as replay)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupPollyContext } from '@/test/polly/setup'
import { searchSpotifyTracks } from './spotify'

describe('Spotify API Integration', () => {
  // Share single Polly instance across all tests to capture all requests
  const pollyContext = setupPollyContext('spotify-integration', beforeAll, afterAll, 'integration')

  describe('searchSpotifyTracks', () => {
    it('searches for a well-known artist and album', async () => {
      const results = await searchSpotifyTracks({
        artist: 'The Beatles',
        album: 'Abbey Road',
      })

      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)

      // Verify the structure of returned tracks
      const firstTrack = results[0]
      expect(firstTrack).toHaveProperty('id')
      expect(firstTrack).toHaveProperty('name')
      expect(firstTrack).toHaveProperty('artists')
      expect(firstTrack).toHaveProperty('album')
      expect(firstTrack).toHaveProperty('uri')
    })

    it('searches by artist only', async () => {
      const results = await searchSpotifyTracks({
        artist: 'Radiohead',
      })

      expect(results).toBeDefined()
      expect(results.length).toBeGreaterThan(0)

      // All results should have Radiohead as an artist
      results.forEach((track) => {
        const artistNames = track.artists.map((a) => a.name.toLowerCase())
        expect(artistNames.some((name) => name.includes('radiohead'))).toBe(true)
      })
    })

    it('searches by track name', async () => {
      const results = await searchSpotifyTracks({
        track: 'Bohemian Rhapsody',
        artist: 'Queen',
      })

      expect(results).toBeDefined()
      expect(results.length).toBeGreaterThan(0)

      // Should find the song
      const matchingTracks = results.filter((track) =>
        track.name.toLowerCase().includes('bohemian')
      )
      expect(matchingTracks.length).toBeGreaterThan(0)
    })

    it('returns empty array for non-existent content', async () => {
      const results = await searchSpotifyTracks({
        artist: 'xyznonexistentartist12345',
        album: 'xyznonexistentalbum12345',
      })

      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(0)
    })

    it('handles special characters in search queries', async () => {
      const results = await searchSpotifyTracks({
        artist: "Guns N' Roses",
        album: 'Appetite for Destruction',
      })

      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
      // The API should handle the apostrophe in the band name
    })
  })
})
