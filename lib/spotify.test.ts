/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchSpotifyTracks, escapeSpotifyQuery } from './spotify'
import { setupPollyContext } from '@/test/polly/setup'
import { POPULAR_SONGS } from '@/test/fixtures/popular-songs'

// Mock the cache module to avoid database complexity in unit tests
// This allows Polly to record/replay actual Spotify API calls
vi.mock('./spotify-cache', () => ({
  getCachedSearch: vi.fn().mockResolvedValue(null),
  setCachedSearch: vi.fn().mockResolvedValue(undefined),
}))

describe('Spotify Client', () => {
  // Setup Polly for HTTP recording/replaying
  const pollyContext = setupPollyContext('spotify-client', beforeEach, afterEach, 'unit')

  beforeEach(() => {
    vi.clearAllMocks()
    // Set up real Spotify environment variables
    // These are only used in 'record' mode; in 'replay' mode, no API calls are made
    process.env.SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || 'test-client-id'
    process.env.SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || 'test-client-secret'
  })

  describe('searchSpotifyTracks', () => {
    it('searches Spotify for Hey Jude by The Beatles', async () => {
      const song = POPULAR_SONGS['The Beatles'].songs['Hey Jude']

      const results = await searchSpotifyTracks({
        artist: song.artist,
        track: song.title, // Search by track name for more precise results
      })

      // Verify we got results
      expect(results.length).toBeGreaterThan(0)

      // First result should be Hey Jude (may include remaster info like "- Remastered 2015")
      expect(results[0].name).toContain('Hey Jude')
      expect(results[0].artists[0].name).toBe('The Beatles')
    })

    it('searches Spotify for specific track', async () => {
      const song = POPULAR_SONGS['Radiohead'].songs['Creep']

      const results = await searchSpotifyTracks({
        artist: song.artist,
        track: song.title,
      })

      // Should find the track
      expect(results.length).toBeGreaterThan(0)

      // First result should be the actual song
      expect(results[0].name).toBe('Creep')
      expect(results[0].artists[0].name).toBe('Radiohead')
    })

    it('handles empty search results for nonsense query', async () => {
      const results = await searchSpotifyTracks({
        artist: 'ZzZzNonexistentArtistXxXx12345',
        album: 'NonexistentAlbumYyYy67890',
      })

      expect(results).toEqual([])
    })

    it('constructs query with only artist field', async () => {
      const song = POPULAR_SONGS['Queen'].songs['Bohemian Rhapsody']

      const results = await searchSpotifyTracks({
        artist: song.artist,
      })

      // Should find Queen songs
      expect(results.length).toBeGreaterThan(0)
      expect(results.some(track => track.artists[0].name === 'Queen')).toBe(true)
    })

    it('throws error when no search parameters provided', async () => {
      await expect(searchSpotifyTracks({})).rejects.toThrow(
        'At least one search parameter (artist, album, or track) is required'
      )
    })

    it('escapes special characters in search queries', async () => {
      // AC/DC has a slash which could break queries if not handled
      const results = await searchSpotifyTracks({
        artist: 'AC/DC',
        track: 'Back in Black',
      })

      // Should successfully search despite special character
      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe('escapeSpotifyQuery', () => {
    it('returns empty string for null or undefined', () => {
      expect(escapeSpotifyQuery(null as unknown as string)).toBe('')
      expect(escapeSpotifyQuery(undefined as unknown as string)).toBe('')
    })

    it('returns empty string for whitespace-only input', () => {
      expect(escapeSpotifyQuery('   ')).toBe('')
      expect(escapeSpotifyQuery('\t\n')).toBe('')
    })

    it('trims whitespace from input', () => {
      expect(escapeSpotifyQuery('  hello  ')).toBe('hello')
    })

    it('removes double quotes', () => {
      expect(escapeSpotifyQuery('My "Love" Song')).toBe('My Love Song')
      expect(escapeSpotifyQuery('"Quoted"')).toBe('Quoted')
    })

    it('removes single quotes that could interfere', () => {
      expect(escapeSpotifyQuery("It's a song")).toBe("It's a song")
    })

    it('removes colons (field separators)', () => {
      expect(escapeSpotifyQuery('Part 1: The Beginning')).toBe('Part 1 The Beginning')
    })

    it('removes asterisks (wildcards)', () => {
      expect(escapeSpotifyQuery('Super*Star')).toBe('SuperStar')
    })

    it('handles exclamation marks', () => {
      expect(escapeSpotifyQuery('Hey!')).toBe('Hey')
    })

    it('handles parentheses', () => {
      expect(escapeSpotifyQuery('Song (Remix)')).toBe('Song Remix')
      expect(escapeSpotifyQuery('Song [Live]')).toBe('Song Live')
    })

    it('normalizes multiple spaces to single space', () => {
      expect(escapeSpotifyQuery('Hello   World')).toBe('Hello World')
      expect(escapeSpotifyQuery('a  :  b')).toBe('a b')
    })

    it('handles real-world examples', () => {
      expect(escapeSpotifyQuery('AC/DC')).toBe('AC/DC')
      expect(escapeSpotifyQuery('Guns N\' Roses')).toBe("Guns N' Roses")
      expect(escapeSpotifyQuery('P!nk')).toBe('Pnk')
      expect(escapeSpotifyQuery('Ke$ha')).toBe('Keha')
      expect(escapeSpotifyQuery('The Beatles: 1967-1970')).toBe('The Beatles 1967-1970')
    })

    it('preserves unicode characters', () => {
      expect(escapeSpotifyQuery('Björk')).toBe('Björk')
      expect(escapeSpotifyQuery('Sigur Rós')).toBe('Sigur Rós')
      expect(escapeSpotifyQuery('日本語')).toBe('日本語')
    })

    it('handles combined edge cases', () => {
      expect(escapeSpotifyQuery('  "Hey!" Part 1: *Remix*  ')).toBe('Hey Part 1 Remix')
    })
  })
})
