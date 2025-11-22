/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchSpotifyTracks, escapeSpotifyQuery } from './spotify'

// Mock the Spotify SDK
vi.mock('@spotify/web-api-ts-sdk', () => ({
  SpotifyApi: {
    withClientCredentials: vi.fn(() => ({
      search: vi.fn(),
    })),
  },
}))

// Mock the cache module to always miss (for testing API calls)
vi.mock('./spotify-cache', () => ({
  getCachedSearch: vi.fn().mockResolvedValue(null),
  setCachedSearch: vi.fn().mockResolvedValue(undefined),
}))

import { SpotifyApi } from '@spotify/web-api-ts-sdk'

describe('Spotify Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set up test environment variables
    process.env.SPOTIFY_CLIENT_ID = 'test-client-id'
    process.env.SPOTIFY_CLIENT_SECRET = 'test-client-secret'
  })

  describe('searchSpotifyTracks', () => {
    it('searches Spotify using artist and album', async () => {
      const mockSearch = vi.fn().mockResolvedValue({
        tracks: {
          items: [
            {
              id: 'spotify123',
              name: 'Test Song',
              artists: [{ name: 'Test Artist' }],
              album: { name: 'Test Album' },
            },
          ],
        },
      })

      const mockSdk = {
        search: mockSearch,
      }

      vi.mocked(SpotifyApi.withClientCredentials).mockReturnValue(mockSdk as any)

      const results = await searchSpotifyTracks({
        artist: 'Test Artist',
        album: 'Test Album',
      })

      expect(SpotifyApi.withClientCredentials).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String)
      )
      expect(mockSearch).toHaveBeenCalledWith(
        'artist:Test Artist album:Test Album',
        ['track'],
        undefined,
        20
      )
      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({
        id: 'spotify123',
        name: 'Test Song',
      })
    })

    it('handles empty search results', async () => {
      const mockSearch = vi.fn().mockResolvedValue({
        tracks: {
          items: [],
        },
      })

      vi.mocked(SpotifyApi.withClientCredentials).mockReturnValue({
        search: mockSearch,
      } as any)

      const results = await searchSpotifyTracks({
        artist: 'Unknown Artist',
        album: 'Unknown Album',
      })

      expect(results).toEqual([])
    })

    it('constructs query with only provided fields', async () => {
      const mockSearch = vi.fn().mockResolvedValue({ tracks: { items: [] } })

      vi.mocked(SpotifyApi.withClientCredentials).mockReturnValue({
        search: mockSearch,
      } as any)

      await searchSpotifyTracks({ artist: 'Test Artist' })

      expect(mockSearch).toHaveBeenCalledWith(
        'artist:Test Artist',
        ['track'],
        undefined,
        20
      )
    })

    it('handles API errors gracefully', async () => {
      const mockSearch = vi.fn().mockRejectedValue(new Error('API Error'))

      vi.mocked(SpotifyApi.withClientCredentials).mockReturnValue({
        search: mockSearch,
      } as any)

      await expect(
        searchSpotifyTracks({ artist: 'Test' })
      ).rejects.toThrow('API Error')
    })

    it('escapes special characters in search queries', async () => {
      const mockSearch = vi.fn().mockResolvedValue({ tracks: { items: [] } })

      vi.mocked(SpotifyApi.withClientCredentials).mockReturnValue({
        search: mockSearch,
      } as any)

      await searchSpotifyTracks({ artist: 'AC/DC', track: 'My "Love" Song' })

      // Verify the query has escaped special characters
      const calledQuery = mockSearch.mock.calls[0][0]
      expect(calledQuery).not.toContain('"')
      expect(calledQuery).toContain('AC/DC') // Forward slash is safe
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
