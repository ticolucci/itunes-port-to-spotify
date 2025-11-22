/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSpotifyTrack } from './test-helpers/fixtures'

// Mock the database module
vi.mock('./db', () => ({
  getDatabase: vi.fn(),
}))

import { getDatabase } from './db'
import {
  getCachedSearch,
  setCachedSearch,
  clearExpiredCache,
  generateCacheKey,
  isCacheExpired,
  CACHE_TTL_MS,
} from './spotify-cache'
import type { SpotifySearchParams } from './spotify'

describe('Spotify Search Cache', () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getDatabase).mockReturnValue(mockDb as any)
  })

  describe('generateCacheKey', () => {
    it('generates consistent key for same params', () => {
      const params: SpotifySearchParams = { artist: 'Beatles', album: 'Abbey Road' }
      const key1 = generateCacheKey(params)
      const key2 = generateCacheKey(params)
      expect(key1).toBe(key2)
    })

    it('generates different keys for different params', () => {
      const key1 = generateCacheKey({ artist: 'Beatles' })
      const key2 = generateCacheKey({ artist: 'Rolling Stones' })
      expect(key1).not.toBe(key2)
    })

    it('handles undefined params consistently', () => {
      const key1 = generateCacheKey({ artist: 'Beatles' })
      const key2 = generateCacheKey({ artist: 'Beatles', album: undefined })
      expect(key1).toBe(key2)
    })

    it('normalizes params by trimming whitespace', () => {
      const key1 = generateCacheKey({ artist: 'Beatles' })
      const key2 = generateCacheKey({ artist: '  Beatles  ' })
      expect(key1).toBe(key2)
    })

    it('normalizes params to lowercase', () => {
      const key1 = generateCacheKey({ artist: 'beatles' })
      const key2 = generateCacheKey({ artist: 'BEATLES' })
      expect(key1).toBe(key2)
    })
  })

  describe('isCacheExpired', () => {
    it('returns false for cache entry within TTL', () => {
      const now = Date.now()
      const createdAt = now - (CACHE_TTL_MS / 2) // Half the TTL ago
      expect(isCacheExpired(createdAt, now)).toBe(false)
    })

    it('returns true for cache entry older than TTL', () => {
      const now = Date.now()
      const createdAt = now - CACHE_TTL_MS - 1000 // TTL + 1 second ago
      expect(isCacheExpired(createdAt, now)).toBe(true)
    })

    it('returns false for cache entry exactly at TTL boundary', () => {
      const now = Date.now()
      const createdAt = now - CACHE_TTL_MS
      expect(isCacheExpired(createdAt, now)).toBe(false)
    })
  })

  describe('getCachedSearch', () => {
    it('returns cached results if cache hit and not expired', async () => {
      const mockTracks = [
        createMockSpotifyTrack({ id: 'track1', name: 'Come Together' }),
        createMockSpotifyTrack({ id: 'track2', name: 'Something' }),
      ]

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                cache_key: 'test-key',
                results: JSON.stringify(mockTracks),
                created_at: Date.now(),
              },
            ]),
          }),
        }),
      })
      mockDb.select.mockImplementation(mockSelect)

      const result = await getCachedSearch({ artist: 'Beatles', album: 'Abbey Road' })

      expect(result).not.toBeNull()
      expect(result).toHaveLength(2)
      expect(result![0].name).toBe('Come Together')
    })

    it('returns null for cache miss', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })
      mockDb.select.mockImplementation(mockSelect)

      const result = await getCachedSearch({ artist: 'Unknown Artist' })
      expect(result).toBeNull()
    })

    it('returns null and deletes entry if cache hit but expired', async () => {
      const mockTracks = [createMockSpotifyTrack()]
      const expiredTime = Date.now() - CACHE_TTL_MS - 10000 // Expired

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                cache_key: 'test-key',
                results: JSON.stringify(mockTracks),
                created_at: expiredTime,
              },
            ]),
          }),
        }),
      })
      mockDb.select.mockImplementation(mockSelect)

      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      })
      mockDb.delete.mockImplementation(mockDelete)

      const result = await getCachedSearch({ artist: 'Beatles' })

      expect(result).toBeNull()
      expect(mockDb.delete).toHaveBeenCalled()
    })
  })

  describe('setCachedSearch', () => {
    it('stores search results in cache with timestamp', async () => {
      const mockTracks = [
        createMockSpotifyTrack({ id: 'track1' }),
        createMockSpotifyTrack({ id: 'track2' }),
      ]

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        }),
      })
      mockDb.insert.mockImplementation(mockInsert)

      await setCachedSearch({ artist: 'Beatles' }, mockTracks)

      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('updates existing cache entry on conflict', async () => {
      const mockTracks = [createMockSpotifyTrack()]

      const mockOnConflict = vi.fn().mockResolvedValue(undefined)
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: mockOnConflict,
        }),
      })
      mockDb.insert.mockImplementation(mockInsert)

      await setCachedSearch({ artist: 'Beatles' }, mockTracks)

      expect(mockOnConflict).toHaveBeenCalled()
    })
  })

  describe('CACHE_TTL_MS', () => {
    it('is set to 30 days (in milliseconds)', () => {
      expect(CACHE_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000)
    })
  })

  describe('clearExpiredCache', () => {
    it('deletes entries older than TTL and returns count of deleted rows', async () => {
      const mockWhere = vi.fn().mockResolvedValue({ rowsAffected: 5 })
      const mockDelete = vi.fn().mockReturnValue({
        where: mockWhere,
      })
      mockDb.delete.mockImplementation(mockDelete)

      const result = await clearExpiredCache()

      expect(mockDb.delete).toHaveBeenCalled()
      expect(mockWhere).toHaveBeenCalled()
      expect(result).toBe(5)
    })

    it('returns 0 when no expired entries exist', async () => {
      const mockWhere = vi.fn().mockResolvedValue({ rowsAffected: 0 })
      mockDb.delete.mockReturnValue({
        where: mockWhere,
      })

      const result = await clearExpiredCache()
      expect(result).toBe(0)
    })

    it('returns 0 when rowsAffected is undefined', async () => {
      const mockWhere = vi.fn().mockResolvedValue({})
      mockDb.delete.mockReturnValue({
        where: mockWhere,
      })

      const result = await clearExpiredCache()
      expect(result).toBe(0)
    })
  })
})
