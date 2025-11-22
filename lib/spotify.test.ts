/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchSpotifyTracks } from './spotify'

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
  })
})
