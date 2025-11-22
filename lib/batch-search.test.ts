/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Song } from './schema'
import { createMockSong } from './test-helpers/fixtures'

// Mock bottleneck for controlled testing - must be inline due to hoisting
vi.mock('bottleneck', () => {
  const MockBottleneck = function(this: any) {
    this.schedule = (fn: () => Promise<any>) => fn()
    this.stop = () => {}
    return this
  }
  return {
    default: MockBottleneck,
  }
})

import { batchSearchSongs, createSpotifyLimiter, resetDefaultLimiter } from './batch-search'

describe('batch-search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDefaultLimiter()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createSpotifyLimiter', () => {
    it('creates a Bottleneck limiter with rate limit options', () => {
      const limiter = createSpotifyLimiter()

      // The limiter should have the schedule method
      expect(limiter).toHaveProperty('schedule')
      expect(typeof limiter.schedule).toBe('function')
    })

    it('accepts custom options and returns a limiter', () => {
      const limiter = createSpotifyLimiter({ maxConcurrent: 10, minTime: 50 })

      expect(limiter).toHaveProperty('schedule')
      expect(typeof limiter.schedule).toBe('function')
    })
  })

  describe('batchSearchSongs', () => {
    it('calls searchFn for each song without spotify_id', async () => {
      const songs: Song[] = [
        createMockSong({ id: 1, spotify_id: null }),
        createMockSong({ id: 2, spotify_id: 'already_matched' }),
        createMockSong({ id: 3, spotify_id: null }),
      ]

      const searchFn = vi.fn().mockResolvedValue(undefined)

      await batchSearchSongs(songs, searchFn)

      // Should only search for unmatched songs (id 1 and 3)
      expect(searchFn).toHaveBeenCalledTimes(2)
      expect(searchFn).toHaveBeenCalledWith(songs[0])
      expect(searchFn).toHaveBeenCalledWith(songs[2])
    })

    it('skips songs that already have spotify_id', async () => {
      const songs: Song[] = [
        createMockSong({ id: 1, spotify_id: 'existing_match' }),
        createMockSong({ id: 2, spotify_id: 'another_match' }),
      ]

      const searchFn = vi.fn().mockResolvedValue(undefined)

      await batchSearchSongs(songs, searchFn)

      expect(searchFn).not.toHaveBeenCalled()
    })

    it('handles empty song array', async () => {
      const searchFn = vi.fn().mockResolvedValue(undefined)

      await batchSearchSongs([], searchFn)

      expect(searchFn).not.toHaveBeenCalled()
    })

    it('processes all songs concurrently with rate limiting', async () => {
      const songs: Song[] = [
        createMockSong({ id: 1, spotify_id: null }),
        createMockSong({ id: 2, spotify_id: null }),
        createMockSong({ id: 3, spotify_id: null }),
        createMockSong({ id: 4, spotify_id: null }),
        createMockSong({ id: 5, spotify_id: null }),
      ]

      const callOrder: number[] = []
      const searchFn = vi.fn().mockImplementation(async (song: Song) => {
        callOrder.push(song.id)
        return undefined
      })

      await batchSearchSongs(songs, searchFn)

      expect(searchFn).toHaveBeenCalledTimes(5)
      expect(callOrder).toHaveLength(5)
    })

    it('handles search errors gracefully', async () => {
      const songs: Song[] = [
        createMockSong({ id: 1, spotify_id: null }),
        createMockSong({ id: 2, spotify_id: null }),
        createMockSong({ id: 3, spotify_id: null }),
      ]

      const searchFn = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce(undefined)

      // Should not throw - errors are handled per-song
      await expect(batchSearchSongs(songs, searchFn)).resolves.not.toThrow()
      expect(searchFn).toHaveBeenCalledTimes(3)
    })

    it('calls onError callback when search fails', async () => {
      const songs: Song[] = [
        createMockSong({ id: 1, spotify_id: null }),
        createMockSong({ id: 2, spotify_id: null }),
      ]

      const error = new Error('API Error')
      const searchFn = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(error)

      const onError = vi.fn()

      await batchSearchSongs(songs, searchFn, { onError })

      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith(songs[1], error)
    })

    it('calls onComplete callback when all searches finish', async () => {
      const songs: Song[] = [
        createMockSong({ id: 1, spotify_id: null }),
        createMockSong({ id: 2, spotify_id: null }),
      ]

      const searchFn = vi.fn().mockResolvedValue(undefined)
      const onComplete = vi.fn()

      await batchSearchSongs(songs, searchFn, { onComplete })

      expect(onComplete).toHaveBeenCalledTimes(1)
      expect(onComplete).toHaveBeenCalledWith({ total: 2, succeeded: 2, failed: 0 })
    })

    it('reports correct stats when some searches fail', async () => {
      const songs: Song[] = [
        createMockSong({ id: 1, spotify_id: null }),
        createMockSong({ id: 2, spotify_id: null }),
        createMockSong({ id: 3, spotify_id: null }),
      ]

      const searchFn = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce(undefined)

      const onComplete = vi.fn()

      await batchSearchSongs(songs, searchFn, { onComplete })

      expect(onComplete).toHaveBeenCalledWith({ total: 3, succeeded: 2, failed: 1 })
    })

    it('uses provided limiter if given', async () => {
      const customLimiter = {
        schedule: vi.fn((fn: () => Promise<any>) => fn()),
      }

      const songs: Song[] = [
        createMockSong({ id: 1, spotify_id: null }),
      ]

      const searchFn = vi.fn().mockResolvedValue(undefined)

      await batchSearchSongs(songs, searchFn, { limiter: customLimiter as any })

      expect(customLimiter.schedule).toHaveBeenCalled()
    })
  })
})
