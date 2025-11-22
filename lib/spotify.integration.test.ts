/**
 * Integration tests for Spotify API using Polly.js for HTTP recording/replay.
 *
 * These tests use real API responses (recorded) instead of mocks, providing
 * more realistic test coverage while remaining fast and deterministic.
 *
 * To update recordings:
 * 1. Ensure SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are set in .env.local
 * 2. Delete the corresponding recording in __recordings__/
 * 3. Run the tests - Polly will record new responses
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setupPollyContext, configurePollyForSpotify, setPollyReplayMode } from './test-helpers/polly-setup'
import { searchSpotifyTracks } from './spotify'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

// Load environment variables for API credentials
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

// Check if recordings exist
const recordingsDir = path.resolve(__dirname, '../__recordings__/spotify-api')
const hasRecordings = fs.existsSync(recordingsDir)
const hasRealCredentials = !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET)

// Skip entire test suite if no credentials AND no recordings
const canRunTests = hasRealCredentials || hasRecordings

describe.skipIf(!canRunTests)('Spotify API Integration', () => {
  const context = setupPollyContext('spotify-api')

  beforeEach(() => {
    // If no real credentials but we have recordings, use replay mode with dummy creds
    if (!hasRealCredentials && hasRecordings && context.polly) {
      setPollyReplayMode(context.polly)
      // Set dummy credentials to pass the initial validation
      process.env.SPOTIFY_CLIENT_ID = 'polly-replay-dummy-id'
      process.env.SPOTIFY_CLIENT_SECRET = 'polly-replay-dummy-secret'
    }
  })

  describe('searchSpotifyTracks', () => {
    it('searches for a well-known artist and album', async () => {
      if (context.polly) {
        configurePollyForSpotify(context.polly)
      }

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
      if (context.polly) {
        configurePollyForSpotify(context.polly)
      }

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
      if (context.polly) {
        configurePollyForSpotify(context.polly)
      }

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
      if (context.polly) {
        configurePollyForSpotify(context.polly)
      }

      const results = await searchSpotifyTracks({
        artist: 'xyznonexistentartist12345',
        album: 'xyznonexistentalbum12345',
      })

      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(0)
    })

    it('handles special characters in search queries', async () => {
      if (context.polly) {
        configurePollyForSpotify(context.polly)
      }

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
